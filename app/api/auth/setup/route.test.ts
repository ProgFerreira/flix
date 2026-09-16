import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")
const hash = vi.fn(async () => "hashed-password")
const issueEmailVerification = vi.fn()

const prisma = {
  user: { findUnique: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: (...args: unknown[]) => getClientIp(...args),
}))

vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => hash(...args) },
  hash: (...args: unknown[]) => hash(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

vi.mock("@/lib/email-verification", () => ({
  issueEmailVerification: (...args: unknown[]) => issueEmailVerification(...args),
}))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/setup", () => {
  beforeEach(() => {
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    hash.mockClear()
    issueEmailVerification.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.user.create.mockReset()
  })

  it("returns 429 when signup is rate limited", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 60_000 })
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "eu@flix.test", password: "senha123", name: "Rener" }))
    expect(res.status).toBe(429)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid email", async () => {
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "nao-e-email", password: "senha123", acceptedTerms: true }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Email inválido/)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("returns 400 when the password is too short", async () => {
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "eu@flix.test", password: "123", acceptedTerms: true }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Mínimo 8/)
  })

  it("returns 400 without saying the email is already registered", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, email: "eu@flix.test" })
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "eu@flix.test", password: "senha123", acceptedTerms: true }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).not.toMatch(/já cadastrado/i)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("creates the user, hashes the password and issues verification without returning the hash", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue({ id: 9, email: "eu@flix.test", name: "Rener" })
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "eu@flix.test", password: "senha123", name: "Rener", acceptedTerms: true }))
    expect(res.status).toBe(200)
    expect(hash).toHaveBeenCalledWith("senha123", 10)
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "eu@flix.test",
        password: "hashed-password",
        name: "Rener",
        consentimentos: expect.objectContaining({ create: expect.any(Array) }),
      }),
      select: { id: true, email: true, name: true },
    }))
    expect(issueEmailVerification).toHaveBeenCalledWith(9, "eu@flix.test")
    const json = await res.json()
    expect(json).toEqual({ id: 9, email: "eu@flix.test", name: "Rener" })
    expect(json).not.toHaveProperty("password")
  })

  it("returns 500 with the Prisma code when the database write fails", async () => {
    prisma.user.findUnique.mockRejectedValue(Object.assign(new Error("table"), { code: "P2021" }))
    const { POST } = await import("@/app/api/auth/setup/route")
    const res = await POST(post({ email: "eu@flix.test", password: "senha123", acceptedTerms: true }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.code).toBe("P2021")
  })
})
