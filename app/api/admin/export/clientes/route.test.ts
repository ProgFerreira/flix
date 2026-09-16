import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const prisma = {
  user: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/audit", () => ({
  logAdminAction: vi.fn(async () => undefined),
}))

describe("GET /api/admin/export/clientes", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.user.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/export/clientes/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/export/clientes"))
    expect(res.status).toBe(403)
  })

  it("returns a CSV attachment with client rows", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.user.findMany.mockResolvedValue([{
      id: 7,
      name: "Ana",
      email: "ana@flix.test",
      phone: "5511994999859",
      role: "user",
      plan: "premium",
      status: "active",
      createdAt: new Date("2026-01-15T00:00:00Z"),
      emailVerifiedAt: new Date("2026-01-15T00:00:00Z"),
      subscription: { status: "active", nextBillingDate: new Date("2026-09-01T00:00:00Z"), billing: "monthly" },
    }])
    const { GET } = await import("@/app/api/admin/export/clientes/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/export/clientes?plan=premium"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/text\/csv/)
    expect(res.headers.get("content-disposition")).toMatch(/clientes-/)
    const body = await res.text()
    expect(body).toContain("ana@flix.test")
    expect(body).toContain("premium")
  })
})
