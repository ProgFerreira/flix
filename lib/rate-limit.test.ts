import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, getClientIp, _resetRateLimitStore } from "@/lib/rate-limit"

describe("checkRateLimit", () => {
  beforeEach(() => _resetRateLimitStore())

  it("allows requests up to the limit", () => {
    const now = 1000
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("k", 5, 60_000, now).allowed).toBe(true)
    }
  })

  it("blocks the request right after the limit is reached", () => {
    const now = 1000
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 60_000, now)
    const result = checkRateLimit("k", 5, 60_000, now)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("resets once the window has passed", () => {
    const start = 1000
    for (let i = 0; i < 5; i++) checkRateLimit("k", 5, 60_000, start)
    expect(checkRateLimit("k", 5, 60_000, start + 60_000).allowed).toBe(true)
  })

  it("keeps independent counters per key", () => {
    const now = 1000
    for (let i = 0; i < 5; i++) checkRateLimit("a", 5, 60_000, now)
    expect(checkRateLimit("a", 5, 60_000, now).allowed).toBe(false)
    expect(checkRateLimit("b", 5, 60_000, now).allowed).toBe(true)
  })
})

describe("getClientIp", () => {
  it("reads x-forwarded-for from a Headers object", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })
    expect(getClientIp(h)).toBe("203.0.113.5")
  })

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.9" })
    expect(getClientIp(h)).toBe("203.0.113.9")
  })

  it("reads from a plain headers object (NextAuth's authorize req)", () => {
    expect(getClientIp({ "x-forwarded-for": "203.0.113.5" })).toBe("203.0.113.5")
  })

  it("returns a fixed fallback when nothing is present", () => {
    expect(getClientIp(undefined)).toBe("unknown")
    expect(getClientIp(new Headers())).toBe("unknown")
  })
})
