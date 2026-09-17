import { describe, it, expect } from "vitest"
import { planRank, hasPlanAccess, plansCoveredBy, catalogVisiblePlanFilter, computeSubscriptionStatus, effectivePlan, canAccessCatalogVideo, SUBSCRIPTION_GRACE_DAYS } from "@/lib/session"

describe("planRank / hasPlanAccess", () => {
  it("orders plans free < premium < pro", () => {
    expect(planRank("free")).toBeLessThan(planRank("premium"))
    expect(planRank("premium")).toBeLessThan(planRank("pro"))
  })

  it("treats unknown plan as rank 0 (free)", () => {
    expect(planRank("unknown")).toBe(0)
  })

  it("grants access when user plan meets or exceeds requirement", () => {
    expect(hasPlanAccess("pro", "premium")).toBe(true)
    expect(hasPlanAccess("premium", "premium")).toBe(true)
    expect(hasPlanAccess("premium", "free")).toBe(true)
  })

  it("denies access when user plan is below requirement", () => {
    expect(hasPlanAccess("free", "premium")).toBe(false)
    expect(hasPlanAccess("premium", "pro")).toBe(false)
  })

  it("lists only plans the viewer already pays for", () => {
    expect(plansCoveredBy("free")).toEqual(["free"])
    expect(plansCoveredBy("premium")).toEqual(["free", "premium"])
    expect(plansCoveredBy("pro")).toEqual(["free", "premium", "pro"])
  })

  it("hides paid catalog rows from free viewers and visitors", () => {
    expect(catalogVisiblePlanFilter({ requesterPlan: "free", isAdmin: false, userId: null })).toEqual({
      requiredPlan: { in: ["free"] },
    })
    expect(catalogVisiblePlanFilter({ requesterPlan: "free", isAdmin: false, userId: 9 })).toEqual({
      OR: [
        { requiredPlan: { in: ["free"] } },
        { accessGrants: { some: { userId: 9 } } },
      ],
    })
  })

  it("does not restrict the default catalog for admin or pro", () => {
    expect(catalogVisiblePlanFilter({ requesterPlan: "free", isAdmin: true, userId: 1 })).toBeNull()
    expect(catalogVisiblePlanFilter({ requesterPlan: "pro", isAdmin: false, userId: 4 })).toBeNull()
  })
})

describe("computeSubscriptionStatus", () => {
  const nextBillingDate = new Date("2026-01-10T00:00:00Z")

  it("stays active before the billing date", () => {
    const now = new Date("2026-01-05T00:00:00Z")
    expect(computeSubscriptionStatus(now, { status: "active", nextBillingDate })).toBe("active")
  })

  it("stays active exactly on the billing date", () => {
    expect(computeSubscriptionStatus(nextBillingDate, { status: "active", nextBillingDate })).toBe("active")
  })

  it("becomes overdue within the grace period after the billing date", () => {
    const now = new Date(nextBillingDate)
    now.setDate(now.getDate() + 1)
    expect(computeSubscriptionStatus(now, { status: "active", nextBillingDate })).toBe("overdue")
  })

  it("becomes overdue right at the edge of the grace period", () => {
    const now = new Date(nextBillingDate)
    now.setDate(now.getDate() + SUBSCRIPTION_GRACE_DAYS)
    expect(computeSubscriptionStatus(now, { status: "active", nextBillingDate })).toBe("overdue")
  })

  it("expires once the grace period has passed", () => {
    const now = new Date(nextBillingDate)
    now.setDate(now.getDate() + SUBSCRIPTION_GRACE_DAYS + 1)
    expect(computeSubscriptionStatus(now, { status: "active", nextBillingDate })).toBe("expired")
  })

  it("never resurrects a subscription the admin cancelled", () => {
    const now = new Date("2020-01-01T00:00:00Z") // muito antes do vencimento
    expect(computeSubscriptionStatus(now, { status: "cancelled", nextBillingDate })).toBe("cancelled")
  })
})

describe("effectivePlan", () => {
  it("returns the stored plan when there is no subscription", () => {
    expect(effectivePlan("premium", null)).toBe("premium")
  })

  it("returns the stored plan while the subscription is active or overdue", () => {
    const nextBillingDate = new Date("2026-01-10T00:00:00Z")
    const now = new Date("2026-01-11T00:00:00Z") // dentro da tolerância
    expect(effectivePlan("premium", { status: "active", nextBillingDate }, now)).toBe("premium")
  })

  it("downgrades to free once the subscription is expired, regardless of stored plan", () => {
    const nextBillingDate = new Date("2026-01-10T00:00:00Z")
    const now = new Date(nextBillingDate)
    now.setDate(now.getDate() + SUBSCRIPTION_GRACE_DAYS + 1)
    expect(effectivePlan("pro", { status: "active", nextBillingDate }, now)).toBe("free")
  })
})

describe("canAccessCatalogVideo", () => {
  const base = { isOwner: false, isAdmin: false, published: true, requiredPlan: "premium", requesterPlan: "free" }

  it("lets the owner watch even when unpublished or plan is insufficient", () => {
    expect(canAccessCatalogVideo({ ...base, isOwner: true, published: false, requesterPlan: "free" })).toBe(true)
  })

  it("lets an admin preview even when unpublished", () => {
    expect(canAccessCatalogVideo({ ...base, isAdmin: true, published: false })).toBe(true)
  })

  it("blocks a stranger from an unpublished video regardless of plan", () => {
    expect(canAccessCatalogVideo({ ...base, published: false, requesterPlan: "pro" })).toBe(false)
  })

  it("blocks a subscriber whose plan is below the requirement", () => {
    expect(canAccessCatalogVideo({ ...base, requesterPlan: "free" })).toBe(false)
  })

  it("allows a subscriber whose plan meets the requirement", () => {
    expect(canAccessCatalogVideo({ ...base, requesterPlan: "premium" })).toBe(true)
  })

  it("allows a subscriber whose plan exceeds the requirement", () => {
    expect(canAccessCatalogVideo({ ...base, requesterPlan: "pro" })).toBe(true)
  })

  it("lets a granted user watch published content below their plan", () => {
    expect(canAccessCatalogVideo({ ...base, requesterPlan: "free", isGranted: true })).toBe(true)
  })

  it("does not let a grant open an unpublished video", () => {
    expect(canAccessCatalogVideo({ ...base, published: false, requesterPlan: "pro", isGranted: true })).toBe(false)
  })
})
