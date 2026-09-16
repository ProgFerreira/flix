import { describe, it, expect } from "vitest"
import { adminGateDestination } from "@/lib/admin-gate"

describe("adminGateDestination", () => {
  it("sends missing users to login", () => {
    expect(adminGateDestination(null)).toBe("/login")
  })

  it("sends a blocked admin to login even if the JWT still says admin", () => {
    expect(adminGateDestination({ role: "admin", status: "blocked" })).toBe("/login")
  })

  it("sends a regular user to home", () => {
    expect(adminGateDestination({ role: "user", status: "active" })).toBe("/")
  })

  it("lets an active admin through", () => {
    expect(adminGateDestination({ role: "admin", status: "active" })).toBeNull()
  })
})
