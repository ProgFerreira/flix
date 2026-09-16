import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const computeSubscriptionStatus = vi.fn()

const prisma = {
  subscription: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  computeSubscriptionStatus: (...args: unknown[]) => computeSubscriptionStatus(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/admin/assinaturas", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    computeSubscriptionStatus.mockReset()
    prisma.subscription.findMany.mockReset()
    prisma.subscription.count.mockReset()
    prisma.subscription.groupBy.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/assinaturas/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/assinaturas"))
    expect(res.status).toBe(403)
    expect(prisma.subscription.findMany).not.toHaveBeenCalled()
  })

  it("serializes amount, recomputes status and paginates", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    computeSubscriptionStatus.mockReturnValue("overdue")
    const row = {
      id: 3,
      plan: "premium",
      billing: "monthly",
      amount: { toString: () => "10.00" },
      status: "active",
      nextBillingDate: new Date("2026-01-01"),
      user: { id: 7, name: "Ana", email: "ana@flix.test", status: "active" },
      payments: [{ id: 11, amount: { toString: () => "10.00" } }],
    }
    prisma.subscription.count.mockResolvedValue(1)
    prisma.subscription.groupBy.mockResolvedValue([{ status: "active", _count: { _all: 1 } }])
    prisma.subscription.findMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ amount: { toString: () => "10" }, billing: "monthly" }])
      .mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/admin/assinaturas/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/assinaturas"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(1)
    expect(json.items[0].amount).toBe("10.00")
    expect(json.items[0].status).toBe("overdue")
    expect(json.items[0].payments[0].amount).toBe("10.00")
    expect(json.total).toBe(1)
    expect(json.stats.active).toBe(1)
  })
})
