import { vi as jobMock } from "vitest"
jobMock.mock("@/lib/job-status", () => ({ recordJobStatus: jobMock.fn() }))
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const isCronAuthorized = vi.fn()
const listDueVideoIds = vi.fn()
const enqueueVideoProcessing = vi.fn()

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: (...args: unknown[]) => isCronAuthorized(...args),
}))
vi.mock("@/lib/video-process", () => ({
  listDueVideoIds: (...args: unknown[]) => listDueVideoIds(...args),
  enqueueVideoProcessing: (...args: unknown[]) => enqueueVideoProcessing(...args),
}))

describe("POST /api/cron/process-videos", () => {
  beforeEach(() => {
    isCronAuthorized.mockReset()
    listDueVideoIds.mockReset()
    enqueueVideoProcessing.mockReset()
  })

  it("returns 401 when the cron secret does not match", async () => {
    isCronAuthorized.mockReturnValue(false)
    const { POST } = await import("@/app/api/cron/process-videos/route")
    const res = await POST(new NextRequest("http://localhost/api/cron/process-videos", { method: "POST" }))
    expect(res.status).toBe(401)
    expect(listDueVideoIds).not.toHaveBeenCalled()
  })

  it("queues due videos when authorized", async () => {
    isCronAuthorized.mockReturnValue(true)
    listDueVideoIds.mockResolvedValue([3, 8])
    const { POST } = await import("@/app/api/cron/process-videos/route")
    const res = await POST(new NextRequest("http://localhost/api/cron/process-videos", { method: "POST" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, queued: 2 })
    expect(enqueueVideoProcessing).toHaveBeenCalledTimes(2)
  })
})
