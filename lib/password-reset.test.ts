import { describe, it, expect } from "vitest"
import { hashResetToken, generateResetToken, isResetTokenValid, RESET_TOKEN_TTL_MS } from "@/lib/password-reset"

describe("hashResetToken", () => {
  it("is deterministic for the same token", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"))
  })

  it("differs for different tokens", () => {
    expect(hashResetToken("abc")).not.toBe(hashResetToken("abd"))
  })
})

describe("generateResetToken", () => {
  it("produces a raw token whose hash matches tokenHash", () => {
    const { token, tokenHash } = generateResetToken()
    expect(hashResetToken(token)).toBe(tokenHash)
  })

  it("produces unique tokens on each call", () => {
    const a = generateResetToken()
    const b = generateResetToken()
    expect(a.token).not.toBe(b.token)
  })

  it("expires exactly RESET_TOKEN_TTL_MS after `now`", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const { expiresAt } = generateResetToken(now)
    expect(expiresAt.getTime()).toBe(now.getTime() + RESET_TOKEN_TTL_MS)
  })
})

describe("isResetTokenValid", () => {
  const expiresAt = new Date("2026-01-01T01:00:00Z")

  it("is valid before expiry and unused", () => {
    const now = new Date("2026-01-01T00:30:00Z")
    expect(isResetTokenValid({ expiresAt, usedAt: null }, now)).toBe(true)
  })

  it("is invalid after expiry", () => {
    const now = new Date("2026-01-01T01:00:01Z")
    expect(isResetTokenValid({ expiresAt, usedAt: null }, now)).toBe(false)
  })

  it("is invalid once already used, even if not expired", () => {
    const now = new Date("2026-01-01T00:30:00Z")
    expect(isResetTokenValid({ expiresAt, usedAt: new Date("2026-01-01T00:10:00Z") }, now)).toBe(false)
  })

  it("is valid exactly at the expiry instant", () => {
    expect(isResetTokenValid({ expiresAt, usedAt: null }, expiresAt)).toBe(true)
  })
})
