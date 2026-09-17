import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class QuotaExceededError extends Error {
  constructor(message = "Limite do plano atingido") {
    super(message)
    this.name = "QuotaExceededError"
  }
}

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const claimVideoSlot = vi.fn()

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: (...args: unknown[]) => claimVideoSlot(...args),
  QuotaExceededError,
}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/upload-stream", () => ({
  streamMultipartVideo: vi.fn(),
  moveUploadToStorage: vi.fn(),
  removeStoredFile: vi.fn(),
  UploadError: class UploadError extends Error {
    status = 400
  },
}))
vi.mock("@/lib/video-process", () => ({
  enqueueVideoProcessing: vi.fn(),
}))

function postJson(body: unknown) {
  return new NextRequest("http://localhost/api/admin/courses/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/admin/courses/lessons", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    claimVideoSlot.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/courses/lessons/route")
    const res = await POST(postJson({ kind: "article", title: "Texto", body: "Corpo" }))
    expect(res.status).toBe(403)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("rejects a non-YouTube URL", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { POST } = await import("@/app/api/admin/courses/lessons/route")
    const res = await POST(postJson({
      kind: "youtube",
      title: "Aula",
      url: "https://example.com/watch?v=abcdefghijk",
    }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Informe um link de vídeo do YouTube" })
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("creates an unpublished article lesson", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const created = {
      id: 44,
      title: "Material",
      notes: "Como cortar",
      source: "article",
      duration: "1:00",
      published: false,
      thumbnail: "/video-placeholder.svg",
    }
    claimVideoSlot.mockImplementation(async (_uid: number, fn: (tx: { video: { create: ReturnType<typeof vi.fn> } }) => unknown) => {
      const tx = { video: { create: vi.fn().mockResolvedValue(created) } }
      return fn(tx)
    })
    const { POST } = await import("@/app/api/admin/courses/lessons/route")
    const res = await POST(postJson({
      kind: "article",
      title: "Material",
      body: "Como cortar",
      requiredPlan: "premium",
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(expect.objectContaining({
      id: 44,
      title: "Material",
      source: "article",
      duration: "1:00",
      published: false,
    }))
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "video.upload",
      targetId: 44,
      meta: expect.objectContaining({ source: "article", courseLesson: true }),
    }))
  })

  it("creates an unpublished YouTube lesson", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const created = {
      id: 12,
      title: "Aula",
      videoId: "abcdefghijk",
      source: "youtube",
      published: false,
    }
    claimVideoSlot.mockImplementation(async (_uid: number, fn: (tx: { video: { create: ReturnType<typeof vi.fn> } }) => unknown) => {
      const tx = { video: { create: vi.fn().mockResolvedValue(created) } }
      return fn(tx)
    })
    const { POST } = await import("@/app/api/admin/courses/lessons/route")
    const res = await POST(postJson({
      kind: "youtube",
      title: "Aula",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({ id: 12, source: "youtube", published: false }))
  })

  it("returns 403 when the plan quota is exceeded", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    claimVideoSlot.mockRejectedValue(new QuotaExceededError())
    const { POST } = await import("@/app/api/admin/courses/lessons/route")
    const res = await POST(postJson({ kind: "article", title: "Texto", body: "Corpo" }))
    expect(res.status).toBe(403)
  })
})
