import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-reset"
import { generateVerificationToken, VERIFY_TOKEN_TTL_MS, requireVerifiedEmail } from "@/lib/email-verification"

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma }))
describe("generateVerificationToken", () => {
  it("lasts 24h and hashes the raw token", () => {
    const now = new Date("2026-08-20T12:00:00Z")
    const { token, tokenHash, expiresAt } = generateVerificationToken(now)
    expect(token).toHaveLength(64)
    expect(tokenHash).toHaveLength(64)
    expect(tokenHash).not.toBe(token)
    expect(expiresAt.getTime() - now.getTime()).toBe(VERIFY_TOKEN_TTL_MS)
  })
})

describe("generateResetToken ttl", () => {
  it("accepts a custom ttl", () => {
    const now = new Date("2026-08-20T12:00:00Z")
    const { expiresAt } = generateResetToken(now, 5_000)
    expect(expiresAt.getTime() - now.getTime()).toBe(5_000)
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000)
  })
})

describe("requireVerifiedEmail", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset()
  })

  it("lets an admin publish without a confirmed email", async () => {
    prisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: null, role: "admin" })
    const result = await requireVerifiedEmail(1)
    expect(result).toEqual({ ok: true })
  })

  it("blocks an unverified member from publishing", async () => {
    prisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: null, role: "user" })
    const result = await requireVerifiedEmail(2)
    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })
})
