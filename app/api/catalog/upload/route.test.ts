import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class QuotaExceededError extends Error {
  constructor(message = "Limite do plano atingido") {
    super(message)
    this.name = "QuotaExceededError"
  }
}

class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

const requireUserId = vi.fn()
const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")
const streamMultipartVideo = vi.fn()
const removeStoredFile = vi.fn()
const moveUploadToStorage = vi.fn()
const detectVideoMime = vi.fn()
const validateUpload = vi.fn()
const generateStoredFilename = vi.fn(() => "stored.mp4")
const ownedCategoryIds = vi.fn(async () => [])
const parseViewerIdsField = vi.fn(() => ({ ok: true as const, ids: [] as number[] }))
const replaceVideoGrants = vi.fn()
const claimVideoSlot = vi.fn()

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock("@/lib/email-verification", () => ({
  requireVerifiedEmail: vi.fn(async () => ({ ok: true })),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: (...args: unknown[]) => getClientIp(...args),
}))

vi.mock("@/lib/upload-stream", () => ({
  UploadError,
  streamMultipartVideo: (...args: unknown[]) => streamMultipartVideo(...args),
  moveUploadToStorage: (...args: unknown[]) => moveUploadToStorage(...args),
  removeStoredFile: (...args: unknown[]) => removeStoredFile(...args),
}))

vi.mock("@/lib/video-storage", () => ({
  PLACEHOLDER_THUMB: "/video-placeholder.svg",
  detectVideoMime: (...args: unknown[]) => detectVideoMime(...args),
  validateUpload: (...args: unknown[]) => validateUpload(...args),
  generateStoredFilename: (...args: unknown[]) => generateStoredFilename(...args),
}))

vi.mock("@/lib/video-process", () => ({
  enqueueVideoProcessing: vi.fn(),
}))

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, after: (fn: () => void) => { fn() } }
})

vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: (...args: unknown[]) => ownedCategoryIds(...args),
}))

vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    parseViewerIdsField: (...args: unknown[]) => parseViewerIdsField(...args),
    replaceVideoGrants: (...args: unknown[]) => replaceVideoGrants(...args),
  }
})

vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: (...args: unknown[]) => claimVideoSlot(...args),
  QuotaExceededError,
}))

function post() {
  return new NextRequest("http://localhost/api/catalog/upload", { method: "POST" })
}

describe("POST /api/catalog/upload", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    streamMultipartVideo.mockReset()
    removeStoredFile.mockReset()
    moveUploadToStorage.mockReset()
    detectVideoMime.mockReset()
    validateUpload.mockReset()
    generateStoredFilename.mockReset()
    generateStoredFilename.mockReturnValue("stored.mp4")
    ownedCategoryIds.mockReset()
    ownedCategoryIds.mockResolvedValue([])
    parseViewerIdsField.mockReset()
    parseViewerIdsField.mockReturnValue({ ok: true, ids: [] })
    claimVideoSlot.mockReset()
  })

  it("returns 403 when the requester is not admin", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(403)
    expect(streamMultipartVideo).not.toHaveBeenCalled()
  })

  it("returns 401 when there is no session", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(401)
    expect(streamMultipartVideo).not.toHaveBeenCalled()
  })

  it("returns 429 when publish is rate limited", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 })
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(429)
  })

  it("maps UploadError to the upload status", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    streamMultipartVideo.mockRejectedValue(new UploadError("Envie o vídeo como multipart/form-data", 400))
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Envie o vídeo como multipart/form-data" })
  })

  it("rejects invalid metadata and removes the temp file", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    streamMultipartVideo.mockResolvedValue({
      fields: { title: "" },
      tempPath: "/tmp/x",
      size: 100,
      header: new Uint8Array(12),
    })
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(400)
    expect(removeStoredFile).toHaveBeenCalledWith("/tmp/x")
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("creates the catalog video and serializes fileSize", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    streamMultipartVideo.mockResolvedValue({
      fields: { title: "Aula gravada", requiredPlan: "free", published: "true" },
      tempPath: "/tmp/x",
      size: 2048,
      header: new Uint8Array(12),
    })
    detectVideoMime.mockReturnValue("video/mp4")
    validateUpload.mockReturnValue({ ok: true })
    moveUploadToStorage.mockResolvedValue("/storage/stored.mp4")
    claimVideoSlot.mockImplementation(async (_uid: number, fn: (tx: { video: { create: ReturnType<typeof vi.fn> } }) => unknown) => {
      const created = {
        id: 20, title: "Aula gravada", fileSize: 2048n, source: "upload", videoCategories: [],
      }
      const tx = { video: { create: vi.fn().mockResolvedValue(created) } }
      return fn(tx)
    })
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe(20)
    expect(json.fileSize).toBe(2048)
    expect(moveUploadToStorage).toHaveBeenCalledWith("/tmp/x", "stored.mp4")
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 7,
      action: "video.upload",
      targetId: 20,
    }))
  })

  it("returns 403 when quota is exceeded and removes the stored file", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    streamMultipartVideo.mockResolvedValue({
      fields: { title: "Aula gravada" },
      tempPath: "/tmp/x",
      size: 2048,
      header: new Uint8Array(12),
    })
    detectVideoMime.mockReturnValue("video/mp4")
    validateUpload.mockReturnValue({ ok: true })
    moveUploadToStorage.mockResolvedValue("/storage/stored.mp4")
    claimVideoSlot.mockRejectedValue(new QuotaExceededError())
    const { POST } = await import("@/app/api/catalog/upload/route")
    const res = await POST(post())
    expect(res.status).toBe(403)
    expect(removeStoredFile).toHaveBeenCalledWith("/storage/stored.mp4")
  })
})
