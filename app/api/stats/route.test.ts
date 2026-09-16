import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  video: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/stats", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.video.findMany.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/stats/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("aggregates totals, favorites and top categories for the user library", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.findMany.mockResolvedValue([
      {
        watched: true, favorite: true, duration: "10:00", channelName: "Canal A",
        createdAt: new Date(),
        videoCategories: [{ category: { id: 1, name: "JS", color: "#fff" } }],
      },
      {
        watched: false, favorite: false, duration: "5:00", channelName: "Canal A",
        createdAt: new Date(),
        videoCategories: [{ category: { id: 1, name: "JS", color: "#fff" } }],
      },
    ])
    const { GET } = await import("@/app/api/stats/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      include: { videoCategories: { include: { category: true } } },
    })
    const json = await res.json()
    expect(json.total).toBe(2)
    expect(json.watched).toBe(1)
    expect(json.unwatched).toBe(1)
    expect(json.favorites).toBe(1)
    expect(json.totalMinutes).toBe(15)
    expect(json.topCategories[0]).toEqual({ name: "JS", color: "#fff", count: 2 })
    expect(json.topChannels[0]).toEqual({ name: "Canal A", count: 2 })
    expect(json.byMonth).toHaveLength(6)
  })
})
