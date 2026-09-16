import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const syncSubscriptionStatus = vi.fn()
const computeSubscriptionStatus = vi.fn()
const getPendingPlanChange = vi.fn()
const deleteUserAccount = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
  syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
  computeSubscriptionStatus: (...args: unknown[]) => computeSubscriptionStatus(...args),
}))

vi.mock("@/lib/plan-change", () => ({
  getPendingPlanChange: (...args: unknown[]) => getPendingPlanChange(...args),
  serializePlanChange: (row: { amount: { toString(): string } }) => ({ ...row, amount: row.amount.toString() }),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/delete-user", () => ({
  deleteUserAccount: (...args: unknown[]) => deleteUserAccount(...args),
}))

describe("GET /api/account", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    syncSubscriptionStatus.mockReset()
    computeSubscriptionStatus.mockReset()
    getPendingPlanChange.mockReset()
    prisma.user.findUnique.mockReset()
    deleteUserAccount.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/account/route")
    const res = await GET()
    expect(res.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns the authenticated user's subscription, pending request and payments", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    syncSubscriptionStatus.mockResolvedValue(null)
    computeSubscriptionStatus.mockReturnValue("active")
    getPendingPlanChange.mockResolvedValue({
      id: 3,
      toPlan: "premium",
      billing: "monthly",
      amount: { toString: () => "10" },
    })
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "eu@flix.test",
      name: "Rener",
      plan: "premium",
      role: "user",
      createdAt: new Date("2026-01-01"),
      emailVerifiedAt: new Date("2026-01-01"),
      _count: { videos: 4 },
      subscription: {
        plan: "premium",
        billing: "monthly",
        amount: { toString: () => "10.00" },
        status: "active",
        startDate: new Date("2026-01-01"),
        nextBillingDate: new Date("2026-09-01"),
        cancelledAt: null,
      },
      payments: [
        {
          id: 11,
          plan: "premium",
          billing: "monthly",
          amount: { toString: () => "10.00" },
          method: "pix",
          createdAt: new Date("2026-01-01"),
        },
      ],
    })

    const { GET } = await import("@/app/api/account/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
    }))
    expect(getPendingPlanChange).toHaveBeenCalledWith(7)

    const json = await res.json()
    expect(json.email).toBe("eu@flix.test")
    expect(json.videoCount).toBe(4)
    expect(json.subscription.amount).toBe("10.00")
    expect(json.subscription.status).toBe("active")
    expect(json.pendingRequest.amount).toBe("10")
    expect(json.payments).toHaveLength(1)
    expect(json.payments[0].amount).toBe("10.00")
    expect(json).not.toHaveProperty("password")
  })
})

describe("DELETE /api/account", () => {
  it("anonymizes the authenticated account", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    deleteUserAccount.mockResolvedValue(undefined)
    const { DELETE } = await import("@/app/api/account/route")
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(deleteUserAccount).toHaveBeenCalledWith(7)
  })
})
