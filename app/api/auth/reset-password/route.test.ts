import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const hashResetToken = vi.fn((token: string) => `hash:${token}`)
const isResetTokenValid = vi.fn()
const hash = vi.fn(async () => "new-hashed-password")

const prisma = {
  passwordResetToken: { findUnique: vi.fn(), update: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(async (ops: unknown) => ops),
}

vi.mock("@/lib/password-reset", () => ({
  hashResetToken: (...args: unknown[]) => hashResetToken(...(args as [string])),
  isResetTokenValid: (...args: unknown[]) => isResetTokenValid(...args),
}))

vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => hash(...args) },
  hash: (...args: unknown[]) => hash(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    hashResetToken.mockClear()
    isResetTokenValid.mockReset()
    hash.mockClear()
    prisma.passwordResetToken.findUnique.mockReset()
    prisma.passwordResetToken.update.mockReset()
    prisma.user.update.mockReset()
    prisma.$transaction.mockClear()
  })

  it("returns 400 when the password is too short", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route")
    const res = await POST(post({ token: "abc", password: "123" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Mínimo 8/)
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled()
  })

  it("returns 400 when the token is missing from the store", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/auth/reset-password/route")
    const res = await POST(post({ token: "gone", password: "senha123" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Link inválido ou expirado. Peça um novo." })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when the token was already used", async () => {
    const record = { id: 1, userId: 7, usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }
    prisma.passwordResetToken.findUnique.mockResolvedValue(record)
    isResetTokenValid.mockReturnValue(false)
    const { POST } = await import("@/app/api/auth/reset-password/route")
    const res = await POST(post({ token: "used", password: "senha123" }))
    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("updates the password and marks the token as used", async () => {
    const record = { id: 3, userId: 7, usedAt: null, expiresAt: new Date(Date.now() + 60_000) }
    prisma.passwordResetToken.findUnique.mockResolvedValue(record)
    isResetTokenValid.mockReturnValue(true)
    const { POST } = await import("@/app/api/auth/reset-password/route")
    const res = await POST(post({ token: "valid-token", password: "senha123" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(hashResetToken).toHaveBeenCalledWith("valid-token")
    expect(hash).toHaveBeenCalledWith("senha123", 10)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { password: "new-hashed-password" },
    })
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { usedAt: expect.any(Date) },
    })
  })
})
