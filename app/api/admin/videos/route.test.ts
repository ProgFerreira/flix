import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { video: { count: vi.fn(), findMany: vi.fn() } },
}))

describe("GET /api/admin/videos", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/videos"))
    expect(res.status).toBe(403)
  })
})
