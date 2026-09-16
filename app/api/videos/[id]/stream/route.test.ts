import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const { optionalUserId, syncSubscriptionStatus, prisma } = vi.hoisted(() => ({
  optionalUserId: vi.fn(),
  syncSubscriptionStatus: vi.fn(),
  prisma: {
    video: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    videoAccessGrant: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    optionalUserId,
    syncSubscriptionStatus,
  }
})
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("fs", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Readable } = require("stream") as typeof import("stream")
  const stream = () => Readable.from(Buffer.from("x".repeat(100)))
  return {
    default: {
      statSync: vi.fn(() => ({ size: 100 })),
      createReadStream: vi.fn(stream),
    },
    statSync: vi.fn(() => ({ size: 100 })),
    createReadStream: vi.fn(stream),
  }
})

describe("GET /api/videos/[id]/stream access", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.videoAccessGrant.findUnique.mockReset()
    prisma.videoAccessGrant.findUnique.mockResolvedValue(null)
    syncSubscriptionStatus.mockResolvedValue(null)
  })

  it("returns 403 when the video is unpublished and the requester is not the owner", async () => {
    optionalUserId.mockResolvedValue(5)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: false,
      requiredPlan: "free",
    })
    prisma.user.findUnique.mockResolvedValue({ plan: "pro", role: "user" })

    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(403)
  })

  it("returns 403 when the subscriber plan is below the requirement", async () => {
    optionalUserId.mockResolvedValue(5)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: true,
      requiredPlan: "premium",
    })
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "user" })

    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(403)
  })

  it("lets the owner stream an unpublished video", async () => {
    optionalUserId.mockResolvedValue(1)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: false,
      requiredPlan: "pro",
    })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(200)
  })

  it("lets an admin stream a published premium video", async () => {
    optionalUserId.mockResolvedValue(9)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: true,
      requiredPlan: "premium",
    })
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "admin" })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(200)
  })

  it("lets a free user stream a published premium video when granted", async () => {
    optionalUserId.mockResolvedValue(5)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: true,
      requiredPlan: "premium",
    })
    prisma.user.findUnique.mockResolvedValue({ plan: "free", role: "user" })
    prisma.videoAccessGrant.findUnique.mockResolvedValue({ videoId: 3 })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(200)
    expect(res.headers.get("etag")).toBe('"100-0"')
    expect(res.headers.get("cache-control")).toBe("private, no-cache")
  })

  it("returns 304 when If-None-Match matches the file ETag", async () => {
    optionalUserId.mockResolvedValue(1)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: false,
      requiredPlan: "pro",
    })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream", {
      headers: { "if-none-match": '"100-0"' },
    }), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(304)
  })

  it("returns 403 when a granted user tries to stream an unpublished video", async () => {
    optionalUserId.mockResolvedValue(5)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "ready",
      published: false,
      requiredPlan: "free",
    })
    prisma.user.findUnique.mockResolvedValue({ plan: "pro", role: "user" })
    prisma.videoAccessGrant.findUnique.mockResolvedValue({ videoId: 3 })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(403)
  })

  it("returns 409 while the upload is still processing", async () => {
    optionalUserId.mockResolvedValue(1)
    prisma.video.findUnique.mockResolvedValue({
      userId: 1,
      source: "upload",
      filePath: "abc.mp4",
      mimeType: "video/mp4",
      status: "processing",
      published: true,
      requiredPlan: "free",
    })
    const { GET } = await import("@/app/api/videos/[id]/stream/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/3/stream"), { params: Promise.resolve({ id: "3" }) })
    expect(res.status).toBe(409)
  })
})
