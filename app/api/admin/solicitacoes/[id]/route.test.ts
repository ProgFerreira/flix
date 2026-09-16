import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class PlanChangeError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "PlanChangeError"
  }
}

const requireAdmin = vi.fn()
const reviewPlanChangeRequest = vi.fn()
const logAdminAction = vi.fn()

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/plan-change", () => ({
  PlanChangeError,
  reviewPlanChangeRequest: (...args: unknown[]) => reviewPlanChangeRequest(...args),
  serializePlanChange: (row: { amount: { toString(): string } }) => ({ ...row, amount: row.amount.toString() }),
}))

vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock("@/lib/api-error", () => ({
  handlePrismaError: () => null,
}))

function patch(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/admin/solicitacoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/admin/solicitacoes/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    reviewPlanChangeRequest.mockReset()
    logAdminAction.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { PATCH } = await import("@/app/api/admin/solicitacoes/[id]/route")
    const res = await PATCH(patch("4", { action: "approve" }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(403)
  })

  it("returns 400 for an invalid id", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { PATCH } = await import("@/app/api/admin/solicitacoes/[id]/route")
    const res = await PATCH(patch("x", { action: "approve" }), { params: Promise.resolve({ id: "x" }) })
    expect(res.status).toBe(400)
  })

  it("returns 400 for an unknown action", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { PATCH } = await import("@/app/api/admin/solicitacoes/[id]/route")
    const res = await PATCH(patch("4", { action: "maybe" }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(400)
    expect(reviewPlanChangeRequest).not.toHaveBeenCalled()
  })

  it("approves, audits and serializes the request", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    reviewPlanChangeRequest.mockResolvedValue({
      id: 4, userId: 7, toPlan: "premium", amount: { toString: () => "10" }, status: "approved",
    })
    const { PATCH } = await import("@/app/api/admin/solicitacoes/[id]/route")
    const res = await PATCH(patch("4", { action: "approve", method: "pix" }), {
      params: Promise.resolve({ id: "4" }),
    })
    expect(res.status).toBe(200)
    expect(reviewPlanChangeRequest).toHaveBeenCalledWith({
      requestId: 4,
      adminId: 1,
      action: "approve",
      method: "pix",
      note: undefined,
    })
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "plan_change.approve",
      targetId: 4,
      meta: { userId: 7, toPlan: "premium" },
    }))
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.request.amount).toBe("10")
  })

  it("maps PlanChangeError to its HTTP status", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    reviewPlanChangeRequest.mockRejectedValue(new PlanChangeError("Já revisada", 409))
    const { PATCH } = await import("@/app/api/admin/solicitacoes/[id]/route")
    const res = await PATCH(patch("4", { action: "reject" }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Já revisada" })
  })
})
