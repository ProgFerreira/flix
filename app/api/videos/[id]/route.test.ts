import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  video: { findUnique: vi.fn(), delete: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: vi.fn(async () => []),
}))

describe("DELETE /api/videos/[id]", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.video.delete.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { DELETE } = await import("@/app/api/videos/[id]/route")
    const res = await DELETE(new NextRequest("http://localhost/api/videos/3", { method: "DELETE" }), {
      params: Promise.resolve({ id: "3" }),
    })
    expect(res.status).toBe(401)
  })

  it("refuses to delete another user's video", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.findUnique.mockResolvedValue({ userId: 99 })
    const { DELETE } = await import("@/app/api/videos/[id]/route")
    const res = await DELETE(new NextRequest("http://localhost/api/videos/3", { method: "DELETE" }), {
      params: Promise.resolve({ id: "3" }),
    })
    expect(res.status).toBe(403)
    expect(prisma.video.delete).not.toHaveBeenCalled()
  })
})
