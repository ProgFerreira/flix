import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const runBillingMaintenance = vi.fn()
const logAdminAction = vi.fn()

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))

vi.mock("@/lib/billing", () => ({
  runBillingMaintenance: (...args: unknown[]) => runBillingMaintenance(...args),
}))

vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

describe("POST /api/admin/billing/sync", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    runBillingMaintenance.mockReset()
    logAdminAction.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/billing/sync/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/billing/sync", { method: "POST" }))
    expect(res.status).toBe(403)
    expect(runBillingMaintenance).not.toHaveBeenCalled()
  })

  it("runs maintenance and writes an audit log", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const result = { checked: 4, changed: 2, upcomingSent: 0, overdueSent: 1 }
    runBillingMaintenance.mockResolvedValue(result)
    const { POST } = await import("@/app/api/admin/billing/sync/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/billing/sync", { method: "POST" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ...result })
    expect(logAdminAction).toHaveBeenCalledWith({
      adminId: 1,
      action: "billing.sync",
      targetType: "billing",
      meta: result,
    })
  })
})
