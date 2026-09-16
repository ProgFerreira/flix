import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { applyRateLimitHit, checkRateLimit, getClientIp, warnIfTrustProxyUnset, _resetRateLimitStore } from "@/lib/rate-limit"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

describe("applyRateLimitHit", () => {
  it("allows requests up to the limit", () => {
    const now = 1000
    let bucket: { count: number; resetAt: number } | undefined
    for (let i = 0; i < 5; i++) {
      const next = applyRateLimitHit(bucket, now, 5, 60_000)
      expect(next.allowed).toBe(true)
      bucket = next.bucket
    }
    expect(applyRateLimitHit(bucket, now, 5, 60_000).allowed).toBe(false)
  })

  it("resets once the window has passed", () => {
    const start = 1000
    let bucket: { count: number; resetAt: number } | undefined
    for (let i = 0; i < 5; i++) {
      bucket = applyRateLimitHit(bucket, start, 5, 60_000).bucket
    }
    expect(applyRateLimitHit(bucket, start + 60_000, 5, 60_000).allowed).toBe(true)
  })
})

describe("checkRateLimit (memory fallback)", () => {
  beforeEach(() => _resetRateLimitStore())

  it("allows requests up to the limit", async () => {
    const now = 1000
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit("k", 5, 60_000, now)).allowed).toBe(true)
    }
  })

  it("blocks the request right after the limit is reached", async () => {
    const now = 1000
    for (let i = 0; i < 5; i++) await checkRateLimit("k", 5, 60_000, now)
    const result = await checkRateLimit("k", 5, 60_000, now)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("keeps independent counters per key", async () => {
    const now = 1000
    for (let i = 0; i < 5; i++) await checkRateLimit("a", 5, 60_000, now)
    expect((await checkRateLimit("a", 5, 60_000, now)).allowed).toBe(false)
    expect((await checkRateLimit("b", 5, 60_000, now)).allowed).toBe(true)
  })
})

describe("getClientIp", () => {
  const original = process.env.TRUST_PROXY

  beforeEach(() => {
    process.env.TRUST_PROXY = "true"
  })

  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = original
  })

  it("reads x-forwarded-for from a Headers object when TRUST_PROXY is on", () => {
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

  it("ignores spoofed forwarded headers when TRUST_PROXY is off", () => {
    process.env.TRUST_PROXY = "false"
    const h = new Headers({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "203.0.113.9" })
    expect(getClientIp(h)).toBe("unknown")
  })
})

describe("warnIfTrustProxyUnset", () => {
  const original = process.env.TRUST_PROXY

  afterEach(() => {
    if (original === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = original
    vi.restoreAllMocks()
  })

  it("warns when TRUST_PROXY is unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    delete process.env.TRUST_PROXY
    warnIfTrustProxyUnset()
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain("TRUST_PROXY não está definida")
  })

  it("warns when TRUST_PROXY is blank", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    process.env.TRUST_PROXY = "  "
    warnIfTrustProxyUnset()
    expect(warn).toHaveBeenCalledOnce()
  })

  it("warns when TRUST_PROXY is neither true nor false", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    process.env.TRUST_PROXY = "True"
    warnIfTrustProxyUnset()
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain("inválida")
  })

  it("stays quiet when TRUST_PROXY is explicitly true or false", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    process.env.TRUST_PROXY = "false"
    warnIfTrustProxyUnset()
    process.env.TRUST_PROXY = "true"
    warnIfTrustProxyUnset()
    expect(warn).not.toHaveBeenCalled()
  })
})
