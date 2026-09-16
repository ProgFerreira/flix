import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  PLAN_PRICES: { premium: { monthly: 10, annual: 96 }, pro: { monthly: 17.9, annual: 171.84 } },
  calcNextBilling: () => new Date("2027-01-01"),
}))

const prisma = {
  planPayment: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  subscription: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("POST /api/admin/payments", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.planPayment.findUnique.mockReset()
    prisma.$transaction.mockReset()
  })

  it("returns 401 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/payments/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/payments", {
      method: "POST",
      body: JSON.stringify({ userId: 1, plan: "premium" }),
    }))
    expect(res.status).toBe(403)
  })

  it("replays an existing payment when the idempotency key matches", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planPayment.findUnique.mockResolvedValue({
      id: 10, amount: { toString: () => "10.00" }, userId: 2, plan: "premium",
    })
    const { POST } = await import("@/app/api/admin/payments/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: 2, plan: "premium", idempotencyKey: "abc12345" }),
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.replayed).toBe(true)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe("GET /api/admin/payments", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.planPayment.count.mockReset()
    prisma.planPayment.findMany.mockReset()
    prisma.planPayment.aggregate.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/payments/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments"))
    expect(res.status).toBe(403)
  })

  it("lists payments with revenue stats and without receipt paths", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planPayment.count.mockResolvedValue(1)
    prisma.planPayment.findMany.mockResolvedValue([{
      id: 10,
      plan: "premium",
      amount: { toString: () => "10.00" },
      receiptPath: "secret/comprovante.pdf",
      receiptMimeType: "application/pdf",
      receiptSize: 123,
      user: { id: 2, name: "Ana", email: "ana@flix.test" },
    }])
    prisma.planPayment.aggregate.mockResolvedValue({
      _sum: { amount: { toString: () => "10.00" } },
      _count: 1,
    })
    const { GET } = await import("@/app/api/admin/payments/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments?plan=premium"))
    expect(res.status).toBe(200)
    expect(prisma.planPayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { plan: "premium" },
    }))
    const json = await res.json()
    expect(json.items[0].amount).toBe("10.00")
    expect(json.items[0].hasReceipt).toBe(true)
    expect(json.items[0]).not.toHaveProperty("receiptPath")
    expect(json.stats).toEqual({ count: 1, revenue: "10.00" })
  })
})
