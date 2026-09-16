import { vi as jobMock } from "vitest"
jobMock.mock("@/lib/job-status", () => ({ recordJobStatus: jobMock.fn() }))
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const isCronAuthorized = vi.fn()
const runBillingMaintenance = vi.fn()

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: (...args: unknown[]) => isCronAuthorized(...args),
}))

vi.mock("@/lib/billing", () => ({
  runBillingMaintenance: (...args: unknown[]) => runBillingMaintenance(...args),
}))

describe("POST /api/cron/billing", () => {
  beforeEach(() => {
    isCronAuthorized.mockReset()
    runBillingMaintenance.mockReset()
  })

  it("returns 401 when the cron secret does not match", async () => {
    isCronAuthorized.mockReturnValue(false)
    const { POST } = await import("@/app/api/cron/billing/route")
    const res = await POST(new NextRequest("http://localhost/api/cron/billing", { method: "POST" }))
    expect(res.status).toBe(401)
    expect(runBillingMaintenance).not.toHaveBeenCalled()
  })

  it("runs billing maintenance when authorized", async () => {
    isCronAuthorized.mockReturnValue(true)
    runBillingMaintenance.mockResolvedValue({ checked: 2, changed: 1, upcomingSent: 1, overdueSent: 0 })
    const { POST } = await import("@/app/api/cron/billing/route")
    const res = await POST(new NextRequest("http://localhost/api/cron/billing", { method: "POST" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true, checked: 2, changed: 1, upcomingSent: 1, overdueSent: 0,
    })
  })
})
