import { describe, it, expect, vi, beforeEach } from "vitest"

const syncSubscriptionStatus = vi.fn()
const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
  }
})
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("resolveCatalogRequester", () => {
  beforeEach(() => {
    syncSubscriptionStatus.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("returns null for a blocked user without syncing the subscription", async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: "blocked",
      role: "user",
      plan: "premium",
      deletadoEm: null,
    })
    const { resolveCatalogRequester } = await import("@/lib/catalog-requester")
    await expect(resolveCatalogRequester(9)).resolves.toBeNull()
    expect(syncSubscriptionStatus).not.toHaveBeenCalled()
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it("reads the user once and treats an expired subscription as free", async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: "active",
      role: "user",
      plan: "premium",
      deletadoEm: null,
    })
    syncSubscriptionStatus.mockResolvedValue({ status: "expired" })
    const { resolveCatalogRequester } = await import("@/lib/catalog-requester")
    await expect(resolveCatalogRequester(9)).resolves.toEqual({
      userId: 9,
      plan: "free",
      role: "user",
    })
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
  })
})
