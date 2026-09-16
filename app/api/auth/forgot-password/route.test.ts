import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")
const generateResetToken = vi.fn()
const sendPasswordResetEmail = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  passwordResetToken: { create: vi.fn() },
}

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: (...args: unknown[]) => getClientIp(...args),
}))

vi.mock("@/lib/password-reset", () => ({
  generateResetToken: (...args: unknown[]) => generateResetToken(...args),
}))

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

const GENERIC = { ok: true, message: "Se esse e-mail tiver uma conta, enviamos um link de redefinição." }

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    generateResetToken.mockReset()
    sendPasswordResetEmail.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.passwordResetToken.create.mockReset()
  })

  it("returns 429 with the generic body when rate limited", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 })
    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const res = await POST(post({ email: "eu@flix.test" }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual(GENERIC)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid email", async () => {
    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const res = await POST(post({ email: "nao-e-email" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Email inválido" })
  })

  it("returns the same generic response when the email is unknown", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const res = await POST(post({ email: "sumido@flix.test" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GENERIC)
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it("stores a token and sends mail when the account exists, still with the generic body", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7, email: "eu@flix.test" })
    generateResetToken.mockReturnValue({
      token: "raw-token",
      tokenHash: "hashed-token",
      expiresAt: new Date("2026-01-02"),
    })
    sendPasswordResetEmail.mockResolvedValue(undefined)
    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const res = await POST(post({ email: "eu@flix.test" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(GENERIC)
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: { userId: 7, tokenHash: "hashed-token", expiresAt: new Date("2026-01-02") },
    })
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "eu@flix.test",
      expect.stringContaining("/redefinir-senha?token=raw-token"),
    )
  })
})
