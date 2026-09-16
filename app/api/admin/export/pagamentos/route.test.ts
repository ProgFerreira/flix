import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const prisma = {
  planPayment: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/audit", () => ({
  logAdminAction: vi.fn(async () => undefined),
}))

describe("GET /api/admin/export/pagamentos", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.planPayment.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/export/pagamentos/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/export/pagamentos"))
    expect(res.status).toBe(403)
  })

  it("returns a CSV attachment with payment rows", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planPayment.findMany.mockResolvedValue([{
      id: 11,
      plan: "premium",
      billing: "monthly",
      amount: { toString: () => "10.00" },
      method: "pix",
      note: null,
      receiptPath: "secret.pdf",
      createdAt: new Date("2026-01-15T00:00:00Z"),
      user: { name: "Ana", email: "ana@flix.test" },
    }])
    const { GET } = await import("@/app/api/admin/export/pagamentos/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/export/pagamentos?method=pix"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toMatch(/pagamentos-/)
    const body = await res.text()
    expect(body).toContain("ana@flix.test")
    expect(body).toContain("10.00")
    expect(body).toContain("pix")
    expect(body).not.toContain("secret.pdf")
  })
})
