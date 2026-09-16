import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { claimVideoSlot } from "@/lib/plan-quota"

const requireUserId = vi.fn()
const prisma = {
  video: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/categories", () => ({ ownedCategoryIds: vi.fn(async (_uid: number, ids?: number[]) => ids ?? []) }))
vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: vi.fn(),
  QuotaExceededError: class QuotaExceededError extends Error {},
}))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/videos", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.video.findMany.mockReset()
    prisma.video.count.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/videos"))
    expect(res.status).toBe(401)
  })

  it("only queries youtube library videos for the authenticated user", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/videos"))
    expect(res.status).toBe(200)
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 7, source: "youtube" }) }),
    )
  })

  it("filters unwatched videos", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/videos/route")
    await GET(new NextRequest("http://localhost/api/videos?status=unwatched"))
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ watched: false, source: "youtube" }) }),
    )
  })

  it("filters watched videos", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.count.mockResolvedValue(0)
    prisma.video.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/videos/route")
    await GET(new NextRequest("http://localhost/api/videos?status=watched"))
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ watched: true }) }),
    )
  })

  it("serializes BigInt fileSize so listing does not 500", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.count.mockResolvedValue(1)
    prisma.video.findMany.mockResolvedValue([{
      id: 1, title: "Aula", fileSize: 2048n, filePath: "secret.mp4",
      videoCategories: [],
    }])
    const { GET } = await import("@/app/api/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/videos"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items[0].fileSize).toBe(2048)
    expect(body.items[0].filePath).toBeUndefined()
  })
})

describe("POST /api/videos", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    vi.mocked(claimVideoSlot).mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/videos/route")
    const res = await POST(post({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Aula" }))
    expect(res.status).toBe(401)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("returns a string error for invalid payload so the add-video toast can render it", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { POST } = await import("@/app/api/videos/route")
    const res = await POST(post({ url: "not-a-url", title: "" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("creates the library video and serializes BigInt fileSize", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    vi.mocked(claimVideoSlot).mockImplementation(async (_uid, fn) => {
      const created = {
        id: 44, title: "Aula", fileSize: 2048n, filePath: "secret.mp4", source: "youtube", videoCategories: [],
      }
      const tx = { video: { create: vi.fn().mockResolvedValue(created) } }
      return fn(tx as never)
    })
    const { POST } = await import("@/app/api/videos/route")
    const res = await POST(post({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Aula",
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(44)
    expect(body.fileSize).toBe(2048)
    expect(body.filePath).toBeUndefined()
  })
})
