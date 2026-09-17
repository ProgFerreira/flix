import { describe, expect, it } from "vitest"
import { safeReturnTo, loginHref, logoutHref } from "./auth-redirect"

describe("login destinations", () => {
  it("preserves a local video destination", () => {
    expect(safeReturnTo("/catalogo?video=42")).toBe("/catalogo?video=42")
    expect(loginHref("/catalogo?video=42", true)).toContain("mode=register")
  })
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/login", "/\nevil.test"])("rejects unsafe destination %s", (value) => {
    expect(safeReturnTo(value)).toBe("/")
  })
  it("sends logout to login with a query so it is not the bare /login cache key", () => {
    expect(logoutHref()).toBe("/login?returnTo=%2F")
    expect(logoutHref().startsWith("/login?")).toBe(true)
  })
})
