import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()

const prisma = {
  planChangeRequest: { count: vi.fn(), findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/plan-change", () => ({
  serializePlanChange: (row: { amount: { toString(): string } }) => ({ ...row, amount: row.amount.toString() }),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/admin/solicitacoes", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.planChangeRequest.count.mockReset()
    prisma.planChangeRequest.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/solicitacoes/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/solicitacoes"))
    expect(res.status).toBe(403)
  })

  it("lists requests with pending stats and serializes amount", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planChangeRequest.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
    prisma.planChangeRequest.findMany.mockResolvedValue([{
      id: 2,
      toPlan: "pro",
      amount: { toString: () => "17.9" },
      status: "pending",
      user: { id: 7, name: "Ana", email: "ana@flix.test", plan: "free", status: "active" },
    }])
    const { GET } = await import("@/app/api/admin/solicitacoes/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/solicitacoes?status=pending"))
    expect(res.status).toBe(200)
    expect(prisma.planChangeRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "pending" },
    }))
    const json = await res.json()
    expect(json.items[0].amount).toBe("17.9")
    expect(json.total).toBe(1)
    expect(json.stats.pending).toBe(3)
  })
})
