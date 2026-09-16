import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const computeSubscriptionStatus = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  planPayment: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  computeSubscriptionStatus: (...args: unknown[]) => computeSubscriptionStatus(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/admin/payments/[userId]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    computeSubscriptionStatus.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.planPayment.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/payments/[userId]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments/7"), {
      params: Promise.resolve({ userId: "7" }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 400 for an invalid user id", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { GET } = await import("@/app/api/admin/payments/[userId]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments/x"), {
      params: Promise.resolve({ userId: "x" }),
    })
    expect(res.status).toBe(400)
  })

  it("returns 404 when the user is missing", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.user.findUnique.mockResolvedValue(null)
    const { GET } = await import("@/app/api/admin/payments/[userId]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments/7"), {
      params: Promise.resolve({ userId: "7" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns the user, recomputed subscription and payments", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    computeSubscriptionStatus.mockReturnValue("active")
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      name: "Ana",
      email: "ana@flix.test",
      role: "user",
      plan: "premium",
      status: "active",
      createdAt: new Date("2026-01-01"),
      emailVerifiedAt: new Date("2026-01-01"),
      _count: { videos: 2, payments: 1 },
      subscription: {
        status: "active",
        nextBillingDate: new Date("2026-09-01"),
      },
    })
    prisma.planPayment.findMany.mockResolvedValue([{ id: 11, amount: 10 }])
    const { GET } = await import("@/app/api/admin/payments/[userId]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/payments/7"), {
      params: Promise.resolve({ userId: "7" }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user.email).toBe("ana@flix.test")
    expect(json.user).not.toHaveProperty("subscription")
    expect(json.subscription.status).toBe("active")
    expect(json.payments).toHaveLength(1)
  })
})
