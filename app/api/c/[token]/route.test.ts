import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { _resetRateLimitStore } from "@/lib/rate-limit"

const prisma = {
  collection: { findUnique: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/c/[token]", () => {
  beforeEach(() => {
    _resetRateLimitStore()
    prisma.collection.findUnique.mockReset()
  })

  it("returns 404 for an invalid token shape", async () => {
    const { GET } = await import("@/app/api/c/[token]/route")
    const res = await GET(
      new NextRequest("http://localhost/api/c/nope"),
      { params: Promise.resolve({ token: "nope" }) },
    )
    expect(res.status).toBe(404)
    expect(prisma.collection.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when the collection exists but is not public", async () => {
    prisma.collection.findUnique.mockResolvedValue({
      name: "Privada", isPublic: false, owner: { name: "Ana" }, videos: [],
    })
    const { GET } = await import("@/app/api/c/[token]/route")
    const token = "valid-public-token-ok12"
    const res = await GET(
      new NextRequest(`http://localhost/api/c/${token}`),
      { params: Promise.resolve({ token }) },
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).not.toHaveProperty("name")
  })

  it("returns only public YouTube fields when the link is on", async () => {
    prisma.collection.findUnique.mockResolvedValue({
      name: "Estudos",
      isPublic: true,
      owner: { name: "Ana" },
      videos: [
        { video: { title: "Aula", thumbnail: "t.jpg", duration: "1:00", channelName: "Canal", source: "youtube", videoId: "abcdefghijk" } },
        { video: { title: "Arquivo", thumbnail: "x", duration: null, channelName: null, source: "upload", videoId: null } },
      ],
    })
    const { GET } = await import("@/app/api/c/[token]/route")
    const token = "valid-public-token-ok12"
    const res = await GET(
      new NextRequest(`http://localhost/api/c/${token}`),
      { params: Promise.resolve({ token }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      name: "Estudos",
      ownerName: "Ana",
      videos: [{
        videoId: "abcdefghijk",
        title: "Aula",
        thumbnail: "t.jpg",
        duration: "1:00",
        channelName: "Canal",
        source: "youtube",
      }],
    })
    expect(JSON.stringify(body)).not.toMatch(/email|filePath|notes/)
  })
})
