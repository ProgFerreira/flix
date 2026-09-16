import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()

const prisma = {
  collectionMember: { findUnique: vi.fn() },
  collectionVideo: { findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  video: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/api-error", () => ({
  handlePrismaError: () => null,
}))

const params = { params: Promise.resolve({ id: "4" }) }

describe("GET /api/collections/[id]/videos", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collectionMember.findUnique.mockReset()
    prisma.collectionVideo.findMany.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/collections/[id]/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/collections/4/videos"), params)
    expect(res.status).toBe(401)
  })

  it("returns 403 when the user is not a member", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue(null)
    const { GET } = await import("@/app/api/collections/[id]/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/collections/4/videos"), params)
    expect(res.status).toBe(403)
  })

  it("serializes videos and omits filePath", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "viewer", userId: 7 })
    prisma.collectionVideo.findMany.mockResolvedValue([{
      video: {
        id: 1, title: "Aula", fileSize: 10n, filePath: "secret.mp4",
        videoCategories: [], user: { id: 7, email: "eu@flix.test", name: "Eu" },
      },
    }])
    const { GET } = await import("@/app/api/collections/[id]/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/collections/4/videos"), params)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].fileSize).toBe(10)
    expect(json[0].filePath).toBeUndefined()
  })
})

describe("POST /api/collections/[id]/videos", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collectionMember.findUnique.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.collectionVideo.upsert.mockReset()
  })

  it("forbids a viewer from adding videos", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "viewer", userId: 7 })
    const { POST } = await import("@/app/api/collections/[id]/videos/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/4/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: 9 }),
      }),
      params,
    )
    expect(res.status).toBe(403)
    expect(prisma.collectionVideo.upsert).not.toHaveBeenCalled()
  })

  it("rejects videos that are not in the requester library", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "owner", userId: 7 })
    prisma.video.findUnique.mockResolvedValue({ userId: 99 })
    const { POST } = await import("@/app/api/collections/[id]/videos/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/4/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: 9 }),
      }),
      params,
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Só é possível adicionar vídeos da sua biblioteca" })
  })

  it("adds an owned video to the collection", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "editor", userId: 7 })
    prisma.video.findUnique.mockResolvedValue({ userId: 7 })
    prisma.collectionVideo.upsert.mockResolvedValue({ collectionId: 4, videoId: 9 })
    const { POST } = await import("@/app/api/collections/[id]/videos/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/4/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: 9 }),
      }),
      params,
    )
    expect(res.status).toBe(200)
    expect(prisma.collectionVideo.upsert).toHaveBeenCalled()
  })
})

describe("DELETE /api/collections/[id]/videos", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collectionMember.findUnique.mockReset()
    prisma.collectionVideo.delete.mockReset()
  })

  it("returns 400 without videoId", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { DELETE } = await import("@/app/api/collections/[id]/videos/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/collections/4/videos", { method: "DELETE" }),
      params,
    )
    expect(res.status).toBe(400)
  })

  it("forbids a viewer from removing videos", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "viewer", userId: 7 })
    const { DELETE } = await import("@/app/api/collections/[id]/videos/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/collections/4/videos?videoId=9", { method: "DELETE" }),
      params,
    )
    expect(res.status).toBe(403)
  })

  it("removes the video from the collection", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "owner", userId: 7 })
    const { DELETE } = await import("@/app/api/collections/[id]/videos/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/collections/4/videos?videoId=9", { method: "DELETE" }),
      params,
    )
    expect(res.status).toBe(200)
    expect(prisma.collectionVideo.delete).toHaveBeenCalledWith({
      where: { collectionId_videoId: { collectionId: 4, videoId: 9 } },
    })
  })
})
