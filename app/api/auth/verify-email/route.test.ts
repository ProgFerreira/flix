import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const hashResetToken = vi.fn((token: string) => `hash:${token}`)
const isResetTokenValid = vi.fn()

const prisma = {
  emailVerificationToken: { findUnique: vi.fn(), update: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(async (ops: unknown) => ops),
}

vi.mock("@/lib/email-verification", () => ({
  hashResetToken: (...args: unknown[]) => hashResetToken(...(args as [string])),
  isResetTokenValid: (...args: unknown[]) => isResetTokenValid(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    hashResetToken.mockClear()
    isResetTokenValid.mockReset()
    prisma.emailVerificationToken.findUnique.mockReset()
    prisma.emailVerificationToken.update.mockReset()
    prisma.user.update.mockReset()
    prisma.$transaction.mockClear()
  })

  it("returns 400 when the token is empty", async () => {
    const { POST } = await import("@/app/api/auth/verify-email/route")
    const res = await POST(post({ token: "" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Link inválido" })
  })

  it("returns 400 for an expired or used token", async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 1, userId: 7, usedAt: new Date(), expiresAt: new Date(),
    })
    isResetTokenValid.mockReturnValue(false)
    const { POST } = await import("@/app/api/auth/verify-email/route")
    const res = await POST(post({ token: "stale" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "Link inválido ou expirado. Peça um novo em Conta.",
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("marks the user as verified and consumes the token", async () => {
    prisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: 4, userId: 7, usedAt: null, expiresAt: new Date(Date.now() + 60_000),
    })
    isResetTokenValid.mockReturnValue(true)
    const { POST } = await import("@/app/api/auth/verify-email/route")
    const res = await POST(post({ token: "good-token" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(hashResetToken).toHaveBeenCalledWith("good-token")
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { emailVerifiedAt: expect.any(Date) },
    })
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { usedAt: expect.any(Date) },
    })
  })
})
