import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const calcNextBilling = vi.fn(() => new Date("2027-01-01"))
const logAdminAction = vi.fn()

const prisma = {
  subscription: { findUnique: vi.fn(), update: vi.fn() },
  user: { update: vi.fn() },
  planPayment: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown) => ops),
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  calcNextBilling: (...args: unknown[]) => calcNextBilling(...args),
}))

vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function patch(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/admin/assinaturas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const sub = {
  id: 9,
  userId: 7,
  plan: "premium",
  billing: "monthly",
  amount: 10,
  user: { id: 7 },
}

describe("PATCH /api/admin/assinaturas/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    calcNextBilling.mockClear()
    logAdminAction.mockReset()
    prisma.subscription.findUnique.mockReset()
    prisma.subscription.update.mockReset()
    prisma.user.update.mockReset()
    prisma.planPayment.create.mockReset()
    prisma.$transaction.mockClear()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "renew" }), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(403)
  })

  it("returns 400 for a non-numeric id", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("abc", { action: "renew" }), { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(400)
  })

  it("returns 404 when the subscription is missing", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.subscription.findUnique.mockResolvedValue(null)
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "renew" }), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(404)
  })

  it("renews, records a payment and audits", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.subscription.findUnique.mockResolvedValue(sub)
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "renew", method: "pix", note: "ok" }), {
      params: Promise.resolve({ id: "9" }),
    })
    expect(res.status).toBe(200)
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { status: "active", nextBillingDate: new Date("2027-01-01"), updatedAt: expect.any(Date) },
    })
    expect(prisma.planPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7, plan: "premium", method: "pix", note: "ok" }),
    })
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 1, action: "subscription.renew", targetId: 9,
    }))
  })

  it("cancels and downgrades the user to free", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.subscription.findUnique.mockResolvedValue(sub)
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "cancel" }), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { plan: "free" },
    })
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "subscription.cancel" }))
  })

  it("reactivates and restores the paid plan", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.subscription.findUnique.mockResolvedValue(sub)
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "reactivate" }), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { plan: "premium" },
    })
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "subscription.reactivate" }))
  })

  it("returns 400 for an unknown action", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { PATCH } = await import("@/app/api/admin/assinaturas/[id]/route")
    const res = await PATCH(patch("9", { action: "explode" }), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(400)
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
  })
})
