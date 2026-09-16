import { describe, it, expect } from "vitest"
import { parsePositiveInt } from "@/lib/admin-users"

describe("parsePositiveInt", () => {
  it("accepts positive integers", () => {
    expect(parsePositiveInt("1")).toBe(1)
    expect(parsePositiveInt("42")).toBe(42)
  })

  it("rejects invalid ids", () => {
    expect(parsePositiveInt("0")).toBeNull()
    expect(parsePositiveInt("-3")).toBeNull()
    expect(parsePositiveInt("1.5")).toBeNull()
    expect(parsePositiveInt("abc")).toBeNull()
  })
})
