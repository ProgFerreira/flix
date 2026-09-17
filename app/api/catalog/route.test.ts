import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class QuotaExceededError extends Error {
  constructor(message = "Limite do plano atingido") {
    super(message)
    this.name = "QuotaExceededError"
  }
}

const optionalUserId = vi.fn()
const requireUserId = vi.fn()
const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const syncSubscriptionStatus = vi.fn()
const canAccessCatalogVideo = vi.fn()
const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")
const ownedCategoryIds = vi.fn(async (_uid: number, ids?: number[]) => ids ?? [])
const claimVideoSlot = vi.fn()
const grantedVideoIdsForUser = vi.fn()
const replaceVideoGrants = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  video: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  favorite: { findMany: vi.fn() },
  watchProgress: { findMany: vi.fn() },
  courseLesson: { findMany: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    optionalUserId: (...args: unknown[]) => optionalUserId(...args),
    requireUserId: (...args: unknown[]) => requireUserId(...args),
    requireAdmin: (...args: unknown[]) => requireAdmin(...args),
    syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
    canAccessCatalogVideo: (...args: unknown[]) => canAccessCatalogVideo(...args),
  }
})

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

vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: (...args: unknown[]) => ownedCategoryIds(...args as [number, number[]?]),
}))

vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: (...args: unknown[]) => claimVideoSlot(...args),
  QuotaExceededError,
}))

vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    grantedVideoIdsForUser: (...args: unknown[]) => grantedVideoIdsForUser(...args),
    replaceVideoGrants: (...args: unknown[]) => replaceVideoGrants(...args),
  }
})

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/catalog", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    syncSubscriptionStatus.mockReset()
    canAccessCatalogVideo.mockReset()
    grantedVideoIdsForUser.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.video.count.mockReset()
    prisma.video.findMany.mockReset()
    prisma.favorite.findMany.mockReset()
    prisma.watchProgress.findMany.mockReset()
    prisma.courseLesson.findMany.mockReset()
    prisma.courseLesson.findMany.mockResolvedValue([])
  })

  it("limits the default catalog to videos covered by the viewer plan", async () => {
    optionalUserId.mockResolvedValue(9)
    syncSubscriptionStatus.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "user" })
    canAccessCatalogVideo.mockReturnValue(true)
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    grantedVideoIdsForUser.mockResolvedValue(new Set())
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{
        OR: [
          { requiredPlan: { in: ["free"] } },
          { accessGrants: { some: { userId: 9 } } },
        ],
      }]) },
    }))
  })

  it("keeps a plan chip listing videos of that plan even when locked", async () => {
    optionalUserId.mockResolvedValue(9)
    syncSubscriptionStatus.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "user" })
    canAccessCatalogVideo.mockReturnValue(false)
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    grantedVideoIdsForUser.mockResolvedValue(new Set())
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog?plan=pro"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ requiredPlan: "pro" }]) },
    }))
    const andFilter = prisma.video.findMany.mock.calls[0]?.[0]?.where?.AND as unknown[]
    expect(andFilter.some((item) => item && typeof item === "object" && "OR" in item)).toBe(false)
  })

  it("lists published ready videos for a visitor and marks locked items", async () => {
    optionalUserId.mockResolvedValue(null)
    canAccessCatalogVideo.mockReturnValue(false)
    prisma.video.count.mockResolvedValue(1)
    prisma.video.findMany.mockResolvedValue([{
      id: 5,
      title: "Aula",
      thumbnail: "t.jpg",
      duration: "10:00",
      channelName: "Canal",
      createdAt: new Date("2026-01-01"),
      requiredPlan: "premium",
      userId: 1,
      source: "youtube",
      videoId: "abcdefghijk",
      published: true,
      videoCategories: [],
    }])
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ status: "ready" }, { published: true }]) },
    }))
    const json = await res.json()
    expect(json.items[0].title).toBe("Aula")
    expect(json.items[0].locked).toBe(true)
    expect(json.items[0].mine).toBe(false)
    expect(json.items[0]).not.toHaveProperty("userId")
  })

  it("excludes videos that belong to a published course", async () => {
    optionalUserId.mockResolvedValue(null)
    canAccessCatalogVideo.mockReturnValue(true)
    prisma.courseLesson.findMany.mockResolvedValue([{ videoId: 9 }])
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ id: { notIn: [9] } }]) },
    }))
  })

  it("returns an empty page when favorited is requested without a session", async () => {
    optionalUserId.mockResolvedValue(null)
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog?favorited=1"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toEqual([])
    expect(json.total).toBe(0)
    expect(prisma.video.findMany).not.toHaveBeenCalled()
  })

  it("scopes mine=1 to the owner and attaches favorite/progress", async () => {
    optionalUserId.mockResolvedValue(7)
    syncSubscriptionStatus.mockResolvedValue(null)
    prisma.user.findUnique.mockResolvedValue({ plan: "premium", role: "user" })
    canAccessCatalogVideo.mockReturnValue(true)
    prisma.video.count.mockResolvedValue(1)
    prisma.video.findMany.mockResolvedValue([{
      id: 5, title: "Meu", thumbnail: "t.jpg", duration: null, channelName: null,
      createdAt: new Date("2026-01-01"), requiredPlan: "free", userId: 7,
      source: "upload", videoId: null, published: false, videoCategories: [],
    }])
    prisma.favorite.findMany.mockResolvedValue([{ videoId: 5 }])
    prisma.watchProgress.findMany.mockResolvedValue([{ videoId: 5, seconds: 42 }])
    grantedVideoIdsForUser.mockResolvedValue(new Set())
    const { GET } = await import("@/app/api/catalog/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog?mine=1"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: expect.arrayContaining([{ userId: 7 }]) },
    }))
    const json = await res.json()
    expect(json.items[0].mine).toBe(true)
    expect(json.items[0].favorited).toBe(true)
    expect(json.items[0].progressSeconds).toBe(42)
    expect(json.items[0].locked).toBe(false)
  })
})

describe("POST /api/catalog", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    ownedCategoryIds.mockReset()
    ownedCategoryIds.mockResolvedValue([])
    claimVideoSlot.mockReset()
    replaceVideoGrants.mockReset()
  })

  it("returns 403 when the requester is not admin", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Aula" }),
    }))
    expect(res.status).toBe(403)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("returns 401 when there is no session", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Aula" }),
    }))
    expect(res.status).toBe(401)
  })

  it("returns 429 when publish is rate limited", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 })
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=abcdefghijk", title: "Aula" }),
    }))
    expect(res.status).toBe(429)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("returns 400 for a non-YouTube URL", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/watch?v=abcdefghijk", title: "Aula" }),
    }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Informe um link de vídeo do YouTube" })
  })

  it("publishes a YouTube link into the catalog", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    const created = { id: 12, title: "Aula", videoId: "abcdefghijk", source: "youtube" }
    claimVideoSlot.mockImplementation(async (_uid: number, fn: (tx: { video: { create: typeof vi.fn } }) => unknown) => {
      const tx = { video: { create: vi.fn().mockResolvedValue(created) } }
      return fn(tx)
    })
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Aula",
        requiredPlan: "free",
      }),
    }))
    expect(res.status).toBe(200)
    expect(claimVideoSlot).toHaveBeenCalled()
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 7,
      action: "video.upload",
      targetType: "video",
      targetId: 12,
    }))
    const json = await res.json()
    expect(json.id).toBe(12)
    expect(json.title).toBe("Aula")
  })

  it("returns 403 when the plan quota is exceeded", async () => {
    requireAdmin.mockResolvedValue({ userId: 7 })
    claimVideoSlot.mockRejectedValue(new QuotaExceededError("Limite do plano Free (máx. 20) atingido. Faça upgrade em /plano."))
    const { POST } = await import("@/app/api/catalog/route")
    const res = await POST(new NextRequest("http://localhost/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Aula",
      }),
    }))
    expect(res.status).toBe(403)
  })
})
