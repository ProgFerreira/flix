import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")
const issueEmailVerification = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: (...args: unknown[]) => getClientIp(...args),
}))

vi.mock("@/lib/email-verification", () => ({
  issueEmailVerification: (...args: unknown[]) => issueEmailVerification(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function post() {
  return new NextRequest("http://localhost/api/auth/resend-verification", { method: "POST" })
}

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    issueEmailVerification.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/auth/resend-verification/route")
    const res = await POST(post())
    expect(res.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns 429 when resend is rate limited", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 })
    const { POST } = await import("@/app/api/auth/resend-verification/route")
    const res = await POST(post())
    expect(res.status).toBe(429)
    expect(issueEmailVerification).not.toHaveBeenCalled()
  })

  it("does not send another email when already verified", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.user.findUnique.mockResolvedValue({
      email: "eu@flix.test",
      emailVerifiedAt: new Date("2026-01-01"),
    })
    const { POST } = await import("@/app/api/auth/resend-verification/route")
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, alreadyVerified: true })
    expect(issueEmailVerification).not.toHaveBeenCalled()
  })

  it("issues a new verification email for an unverified account", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.user.findUnique.mockResolvedValue({ email: "eu@flix.test", emailVerifiedAt: null })
    const { POST } = await import("@/app/api/auth/resend-verification/route")
    const res = await POST(post())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(issueEmailVerification).toHaveBeenCalledWith(7, "eu@flix.test")
  })
})
