import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class PlanChangeError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "PlanChangeError"
  }
}

const requireUserId = vi.fn()
const checkRateLimit = vi.fn()
const getPendingPlanChange = vi.fn()
const createPlanChangeRequest = vi.fn()
const cancelPlanChangeRequest = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}))

vi.mock("@/lib/plan-change", () => ({
  PlanChangeError,
  getPendingPlanChange: (...args: unknown[]) => getPendingPlanChange(...args),
  createPlanChangeRequest: (...args: unknown[]) => createPlanChangeRequest(...args),
  cancelPlanChangeRequest: (...args: unknown[]) => cancelPlanChangeRequest(...args),
  serializePlanChange: (row: { amount: { toString(): string } }) => ({ ...row, amount: row.amount.toString() }),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/api-error", () => ({
  handlePrismaError: () => null,
}))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/plano", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/plano", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    getPendingPlanChange.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/plano/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns the current plan, video count and pending request", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.user.findUnique.mockResolvedValue({ plan: "free", _count: { videos: 3 } })
    getPendingPlanChange.mockResolvedValue({
      id: 2, toPlan: "premium", billing: "monthly", amount: { toString: () => "10" },
    })
    const { GET } = await import("@/app/api/plano/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      plan: "free",
      videoCount: 3,
      pendingRequest: expect.objectContaining({ id: 2, amount: "10" }),
    })
  })
})

describe("POST /api/plano", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    createPlanChangeRequest.mockReset()
  })

  it("returns 429 when plan-change is rate limited", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 })
    const { POST } = await import("@/app/api/plano/route")
    const res = await POST(post({ plan: "premium" }))
    expect(res.status).toBe(429)
    expect(createPlanChangeRequest).not.toHaveBeenCalled()
  })

  it("returns 400 for an unknown plan", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { POST } = await import("@/app/api/plano/route")
    const res = await POST(post({ plan: "enterprise" }))
    expect(res.status).toBe(400)
  })

  it("creates a plan-change request", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    createPlanChangeRequest.mockResolvedValue({
      id: 5, toPlan: "premium", billing: "monthly", amount: { toString: () => "10" },
    })
    const { POST } = await import("@/app/api/plano/route")
    const res = await POST(post({ plan: "premium", billing: "monthly" }))
    expect(res.status).toBe(201)
    expect(createPlanChangeRequest).toHaveBeenCalledWith({
      userId: 7,
      toPlan: "premium",
      billing: "monthly",
      note: undefined,
    })
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.request.amount).toBe("10")
  })

  it("maps PlanChangeError to its HTTP status", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    createPlanChangeRequest.mockRejectedValue(new PlanChangeError("Você já está neste plano", 400))
    const { POST } = await import("@/app/api/plano/route")
    const res = await POST(post({ plan: "free" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Você já está neste plano" })
  })
})

describe("DELETE /api/plano", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    cancelPlanChangeRequest.mockReset()
  })

  it("cancels the pending request", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    cancelPlanChangeRequest.mockResolvedValue(undefined)
    const { DELETE } = await import("@/app/api/plano/route")
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(cancelPlanChangeRequest).toHaveBeenCalledWith(7)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("maps PlanChangeError when there is nothing to cancel", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    cancelPlanChangeRequest.mockRejectedValue(new PlanChangeError("Nenhuma solicitação pendente", 404))
    const { DELETE } = await import("@/app/api/plano/route")
    const res = await DELETE()
    expect(res.status).toBe(404)
  })
})
