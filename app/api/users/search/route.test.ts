import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  user: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterMs: 0 }),
  getClientIp: () => "127.0.0.1",
}))

describe("GET /api/users/search", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.user.findMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/users/search/route")
    const res = await GET(new NextRequest("http://localhost/api/users/search?q=an"))
    expect(res.status).toBe(401)
  })

  it("returns an empty list when the query is too short", async () => {
    requireUserId.mockResolvedValue({ userId: 1 })
    const { GET } = await import("@/app/api/users/search/route")
    const res = await GET(new NextRequest("http://localhost/api/users/search?q=a"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it("searches active users excluding the requester", async () => {
    requireUserId.mockResolvedValue({ userId: 1 })
    prisma.user.findMany.mockResolvedValue([{ id: 2, name: "Ana", email: "ana@x.com", plan: "free" }])
    const { GET } = await import("@/app/api/users/search/route")
    const res = await GET(new NextRequest("http://localhost/api/users/search?q=ana"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 2, name: "Ana", email: "ana@x.com", plan: "free" }])
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "active",
        id: { not: 1 },
      }),
      take: 8,
    }))
  })
})
