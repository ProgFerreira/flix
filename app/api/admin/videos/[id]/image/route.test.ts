import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const checkRateLimit = vi.fn()
const detectImageMime = vi.fn()
const generateImageThumbFilename = vi.fn()
const unlinkLessonThumb = vi.fn()
const ensureThumbsDir = vi.fn()
const resolveThumbPath = vi.fn()
const writeFileSync = vi.fn()

const prisma = {
  video: { findUnique: vi.fn(), update: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}))
vi.mock("@/lib/lesson-image", () => ({
  MAX_LESSON_IMAGE_BYTES: 5 * 1024 * 1024,
  PLACEHOLDER_THUMB: "/video-placeholder.svg",
  detectImageMime: (...args: unknown[]) => detectImageMime(...args),
  generateImageThumbFilename: (...args: unknown[]) => generateImageThumbFilename(...args),
  unlinkLessonThumb: (...args: unknown[]) => unlinkLessonThumb(...args),
}))
vi.mock("@/lib/video-storage", () => ({
  PLACEHOLDER_THUMB: "/video-placeholder.svg",
  ensureThumbsDir: (...args: unknown[]) => ensureThumbsDir(...args),
  resolveThumbPath: (...args: unknown[]) => resolveThumbPath(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("fs", () => ({
  default: {
    writeFileSync: (...args: unknown[]) => writeFileSync(...args),
  },
  writeFileSync: (...args: unknown[]) => writeFileSync(...args),
}))

function jpegFile(size = 3) {
  return new File([new Uint8Array([0xff, 0xd8, 0xff].slice(0, size))], "aula.jpg", { type: "image/jpeg" })
}

async function postFile(id: string, file: File | null) {
  const req = new NextRequest(`http://localhost/api/admin/videos/${id}/image`, { method: "POST" })
  vi.spyOn(req, "formData").mockResolvedValue({ get: () => file } as unknown as FormData)
  const { POST } = await import("@/app/api/admin/videos/[id]/image/route")
  return POST(req, { params: Promise.resolve({ id }) })
}

describe("POST /api/admin/videos/[id]/image", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    checkRateLimit.mockReset()
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    detectImageMime.mockReset()
    generateImageThumbFilename.mockReset()
    unlinkLessonThumb.mockReset()
    ensureThumbsDir.mockReset()
    resolveThumbPath.mockReset()
    writeFileSync.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.video.update.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const res = await postFile("44", jpegFile())
    expect(res.status).toBe(403)
    expect(prisma.video.update).not.toHaveBeenCalled()
  })

  it("returns 404 when the video is not an article lesson", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 8, source: "youtube", thumbPath: null })
    const res = await postFile("8", jpegFile())
    expect(res.status).toBe(404)
  })

  it("rejects an invalid mime type", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 44, source: "article", thumbPath: null })
    detectImageMime.mockReturnValue(null)
    const res = await postFile("44", jpegFile())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Envie uma imagem JPEG, PNG ou WebP." })
  })

  it("stores the image and logs the update", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 44, source: "article", thumbPath: "old.jpg" })
    detectImageMime.mockReturnValue("image/jpeg")
    generateImageThumbFilename.mockReturnValue("new.jpg")
    resolveThumbPath.mockReturnValue("/tmp/new.jpg")
    prisma.video.update.mockResolvedValue({
      id: 44,
      title: "Material",
      source: "article",
      thumbnail: "/api/videos/44/thumbnail",
      notes: "Corpo",
    })

    const res = await postFile("44", jpegFile())
    expect(res.status).toBe(200)
    expect(writeFileSync).toHaveBeenCalled()
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 44 },
      data: {
        thumbPath: "new.jpg",
        thumbnail: "/api/videos/44/thumbnail",
      },
    }))
    expect(unlinkLessonThumb).toHaveBeenCalledWith("old.jpg")
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "video.update",
      targetType: "video",
      targetId: 44,
      meta: expect.objectContaining({ image: true }),
    }))
    expect(await res.json()).toEqual(expect.objectContaining({
      id: 44,
      thumbnail: "/api/videos/44/thumbnail",
    }))
  })
})

describe("DELETE /api/admin/videos/[id]/image", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    unlinkLessonThumb.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.video.update.mockReset()
  })

  it("restores the placeholder and removes the file", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 44, source: "article", thumbPath: "aula.png" })
    prisma.video.update.mockResolvedValue({
      id: 44,
      source: "article",
      thumbnail: "/video-placeholder.svg",
    })
    const { DELETE } = await import("@/app/api/admin/videos/[id]/image/route")
    const res = await DELETE(new NextRequest("http://localhost/api/admin/videos/44/image", { method: "DELETE" }), {
      params: Promise.resolve({ id: "44" }),
    })
    expect(res.status).toBe(200)
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 44 },
      data: { thumbPath: null, thumbnail: "/video-placeholder.svg" },
    }))
    expect(unlinkLessonThumb).toHaveBeenCalledWith("aula.png")
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "video.update",
      targetId: 44,
    }))
  })

  it("returns 404 for a video lesson", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 3, source: "upload", thumbPath: "a.jpg" })
    const { DELETE } = await import("@/app/api/admin/videos/[id]/image/route")
    const res = await DELETE(new NextRequest("http://localhost/api/admin/videos/3/image", { method: "DELETE" }), {
      params: Promise.resolve({ id: "3" }),
    })
    expect(res.status).toBe(404)
    expect(prisma.video.update).not.toHaveBeenCalled()
  })
})
