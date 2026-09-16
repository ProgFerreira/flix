import { describe, expect, it } from "vitest"
import { isPaidPlan, isPlanUpgrade, planChangeAmount, resolveBilling } from "@/lib/plan-change"

describe("isPaidPlan", () => {
  it("marks premium and pro as paid", () => {
    expect(isPaidPlan("premium")).toBe(true)
    expect(isPaidPlan("pro")).toBe(true)
  })

  it("marks free as unpaid", () => {
    expect(isPaidPlan("free")).toBe(false)
  })
})

describe("isPlanUpgrade", () => {
  it("detects upgrades", () => {
    expect(isPlanUpgrade("free", "premium")).toBe(true)
    expect(isPlanUpgrade("premium", "pro")).toBe(true)
    expect(isPlanUpgrade("free", "pro")).toBe(true)
  })

  it("detects downgrades and same plan", () => {
    expect(isPlanUpgrade("pro", "premium")).toBe(false)
    expect(isPlanUpgrade("premium", "free")).toBe(false)
    expect(isPlanUpgrade("pro", "pro")).toBe(false)
  })
})

describe("planChangeAmount", () => {
  it("returns listed prices for paid plans", () => {
    expect(planChangeAmount("premium", "monthly")).toBe(10)
    expect(planChangeAmount("premium", "annual")).toBe(96)
    expect(planChangeAmount("pro", "monthly")).toBe(17.9)
    expect(planChangeAmount("pro", "annual")).toBe(171.84)
  })

  it("returns 0 for free", () => {
    expect(planChangeAmount("free", "monthly")).toBe(0)
  })
})

describe("resolveBilling", () => {
  it("forces monthly on free", () => {
    expect(resolveBilling("free", "annual")).toBe("monthly")
  })

  it("accepts annual only on paid plans", () => {
    expect(resolveBilling("premium", "annual")).toBe("annual")
    expect(resolveBilling("pro", "monthly")).toBe("monthly")
    expect(resolveBilling("premium", "weird")).toBe("monthly")
  })
})
