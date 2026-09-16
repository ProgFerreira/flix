import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const syncSubscriptionStatus = vi.fn()
const grantedVideoIdsForUser = vi.fn()
const prisma = {
  user: { findUnique: vi.fn() },
  watchProgress: { findMany: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    requireUserId: (...args: unknown[]) => requireUserId(...args),
    syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
  }
})
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    grantedVideoIdsForUser: (...args: unknown[]) => grantedVideoIdsForUser(...args),
  }
})

describe("GET /api/catalog/continue", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    syncSubscriptionStatus.mockReset()
    grantedVideoIdsForUser.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.watchProgress.findMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/catalog/continue/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns in-progress videos the viewer can access, newest first", async () => {
    requireUserId.mockResolvedValue({ userId: 5 })
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "user" })
    prisma.watchProgress.findMany.mockResolvedValue([
      {
        seconds: 80,
        video: {
          id: 1, title: "Aula", thumbnail: "t.jpg", duration: "10:00", channelName: "Canal",
          source: "upload", videoId: null, requiredPlan: "free", published: true, userId: 9,
        },
      },
      {
        seconds: 80,
        video: {
          id: 2, title: "Pro", thumbnail: "t.jpg", duration: "10:00", channelName: null,
          source: "upload", videoId: null, requiredPlan: "pro", published: true, userId: 9,
        },
      },
    ])
    grantedVideoIdsForUser.mockResolvedValue(new Set())

    const { GET } = await import("@/app/api/catalog/continue/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe(1)
    expect(body.items[0].progressSeconds).toBe(80)
    expect(body.items[0].remainingLabel).toBe("9 min restantes")
  })
})
