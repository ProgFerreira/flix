import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  category: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/categories", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.category.findMany.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/categories/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("lists categories of the current user", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.category.findMany.mockResolvedValue([{ id: 1, name: "Aulas", userId: 7 }])
    const { GET } = await import("@/app/api/categories/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.category.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 7 },
    }))
  })
})
