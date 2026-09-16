import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  video: { findUnique: vi.fn() },
  videoShare: { findMany: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("POST /api/videos/[id]/share", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.video.findUnique.mockReset()
  })

  it("returns 403 when the requester does not own the video", async () => {
    requireUserId.mockResolvedValue({ userId: 2 })
    prisma.video.findUnique.mockResolvedValue({ userId: 1 })
    const { POST } = await import("@/app/api/videos/[id]/share/route")
    const res = await POST(
      new NextRequest("http://localhost/api/videos/9/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@flix.local", permission: "view" }),
      }),
      { params: Promise.resolve({ id: "9" }) },
    )
    expect(res.status).toBe(403)
  })
})

describe("GET /api/videos/[id]/share", () => {
  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/videos/[id]/share/route")
    const res = await GET(new NextRequest("http://localhost/api/videos/9/share"), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(401)
  })
})
