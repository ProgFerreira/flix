import { describe, it, expect, vi, beforeEach } from "vitest"
import { claimVideoSlot, QuotaExceededError } from "@/lib/plan-quota"

const mockTx = {
  $queryRaw: vi.fn(),
  user: { findUnique: vi.fn() },
  video: { count: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    video: { count: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}))

describe("claimVideoSlot", () => {
  beforeEach(() => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1 }])
    mockTx.user.findUnique.mockResolvedValue({ plan: "free" })
    mockTx.video.create.mockReset()
    mockTx.video.create.mockResolvedValue({ id: 99, title: "ok" })
    mockTx.video.count.mockReset()
  })

  it("creates the video when the user is under the plan limit", async () => {
    mockTx.video.count.mockResolvedValue(19)
    const created = await claimVideoSlot(1, (tx) => tx.video.create({ data: { userId: 1, title: "ok" } } as never))
    expect(created).toEqual({ id: 99, title: "ok" })
    expect(mockTx.$queryRaw).toHaveBeenCalled()
  })

  it("rejects a second create when the count is already at the free limit", async () => {
    mockTx.video.count.mockResolvedValue(20)
    await expect(
      claimVideoSlot(1, (tx) => tx.video.create({ data: { userId: 1, title: "nope" } } as never)),
    ).rejects.toBeInstanceOf(QuotaExceededError)
    expect(mockTx.video.create).not.toHaveBeenCalled()
  })
})
