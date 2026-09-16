import { describe, expect, it } from "vitest"
import { safeReturnTo, loginHref } from "./auth-redirect"

describe("login destinations", () => {
  it("preserves a local video destination", () => {
    expect(safeReturnTo("/catalogo?video=42")).toBe("/catalogo?video=42")
    expect(loginHref("/catalogo?video=42", true)).toContain("mode=register")
  })
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/login", "/\nevil.test"])("rejects unsafe destination %s", (value) => {
    expect(safeReturnTo(value)).toBe("/")
  })
})
