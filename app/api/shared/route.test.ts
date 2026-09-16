import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  videoShare: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/serialize-video", () => ({
  serializeVideo: (v: { id: number }) => v,
}))

describe("GET /api/shared", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.videoShare.findMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/shared/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("lists videos shared with the current user", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.videoShare.findMany.mockResolvedValue([
      { permission: "view", video: { id: 3, user: { id: 1, email: "a@b.com", name: "Ana" } } },
    ])
    const { GET } = await import("@/app/api/shared/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.videoShare.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { toUserId: 7 },
    }))
  })
})
