import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const { optionalUserId, prisma } = vi.hoisted(() => ({
  optionalUserId: vi.fn(),
  prisma: {
    video: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return { ...actual, optionalUserId }
})
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("fs", () => ({
  default: {
    statSync: vi.fn(() => ({ size: 12, mtimeMs: 1 })),
    readFileSync: vi.fn(() => Buffer.from("jpeg-bytes")),
  },
  statSync: vi.fn(() => ({ size: 12, mtimeMs: 1 })),
  readFileSync: vi.fn(() => Buffer.from("jpeg-bytes")),
}))

describe("GET /api/videos/[id]/thumbnail", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("lets a visitor see the thumb of a published video", async () => {
    optionalUserId.mockResolvedValue(null)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1, source: "upload", published: true, thumbPath: "a.jpg",
    })
    const { GET } = await import("@/app/api/videos/[id]/thumbnail/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/thumbnail"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
  })

  it("hides the thumb of an unpublished video from strangers", async () => {
    optionalUserId.mockResolvedValue(5)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1, source: "upload", published: false, thumbPath: "a.jpg",
    })
    prisma.user.findUnique.mockResolvedValue({ role: "user" })
    const { GET } = await import("@/app/api/videos/[id]/thumbnail/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/thumbnail"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(404)
  })

  it("lets the owner see an unpublished thumb", async () => {
    optionalUserId.mockResolvedValue(1)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1, source: "upload", published: false, thumbPath: "a.jpg",
    })
    const { GET } = await import("@/app/api/videos/[id]/thumbnail/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/thumbnail"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(200)
  })
})
