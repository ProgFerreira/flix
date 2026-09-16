import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"

const checkRateLimit = vi.fn()
const getClientIp = vi.fn(() => "127.0.0.1")

const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: (...args: unknown[]) => getClientIp(...args),
}))

vi.mock("@/lib/audit", () => ({
  logAdminAction: vi.fn(async () => undefined),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

async function authorize(
  credentials: { email?: string; password?: string } | undefined,
  headers: Record<string, string> = {},
) {
  const { authOptions } = await import("@/lib/auth")
  const provider = authOptions.providers[0] as {
    options: {
      authorize: (
        creds: { email?: string; password?: string } | undefined,
        req: { headers: Record<string, string> },
      ) => Promise<unknown>
    }
  }
  return provider.options.authorize(credentials, { headers })
}

describe("login authorize (CredentialsProvider)", () => {
  beforeEach(() => {
    checkRateLimit.mockReset()
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    getClientIp.mockReset()
    getClientIp.mockReturnValue("127.0.0.1")
    prisma.user.findUnique.mockReset()
  })

  it("returns null when email or password is missing", async () => {
    expect(await authorize({ email: "eu@flix.test" })).toBeNull()
    expect(await authorize({ password: "senha123" })).toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns null when login is rate limited by IP or email", async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 1 }).mockReturnValueOnce({ allowed: true, retryAfterMs: 0 })
    expect(await authorize({ email: "eu@flix.test", password: "senha123" })).toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("returns null for an unknown email", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    expect(await authorize({ email: "sumido@flix.test", password: "senha123" })).toBeNull()
  })

  it("returns null for a blocked account even with the right password", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7, email: "eu@flix.test", password: "hash", status: "blocked",
      name: "Rener", role: "user", plan: "free", emailVerifiedAt: new Date(), deletadoEm: null,
    })
    expect(await authorize({ email: "eu@flix.test", password: "senha123" })).toBeNull()
  })

  it("returns null when the password does not match", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7, email: "eu@flix.test", password: bcrypt.hashSync("senha123", 4), status: "active",
      name: "Rener", role: "user", plan: "free", emailVerifiedAt: null,
    })
    expect(await authorize({ email: "eu@flix.test", password: "errada" })).toBeNull()
  })

  it("returns null when the database is unreachable instead of throwing", async () => {
    prisma.user.findUnique.mockRejectedValue(new Error("Can't reach database server"))
    await expect(authorize({ email: "eu@flix.test", password: "senha123" })).resolves.toBeNull()
  })

  it("returns the public user fields and never the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "eu@flix.test",
      password: bcrypt.hashSync("senha123", 4),
      status: "active",
      name: "Rener",
      role: "user",
      plan: "premium",
      emailVerifiedAt: new Date("2026-01-01"),
    })
    const user = await authorize({ email: "eu@flix.test", password: "senha123" })
    expect(user).toEqual({
      id: "7",
      email: "eu@flix.test",
      name: "Rener",
      role: "user",
      plan: "premium",
      status: "active",
      emailVerified: true,
      staySignedIn: false,
    })
    expect(user).not.toHaveProperty("password")
  })
})

describe("jwt callback", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset()
  })

  it("keeps the last-known claims when the database is unreachable", async () => {
    prisma.user.findUnique.mockRejectedValue(new Error("Can't reach database server"))
    const { authOptions } = await import("@/lib/auth")
    const token = await authOptions.callbacks!.jwt!({
      token: { id: "7", status: "active", role: "admin", plan: "pro", emailVerified: true, name: "Rener" },
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: undefined,
    })
    expect(token.status).toBe("active")
    expect(token.role).toBe("admin")
    expect(token.plan).toBe("pro")
    expect(token.name).toBe("Rener")
  })

  it("marks the session as blocked when the user no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    const { authOptions } = await import("@/lib/auth")
    const token = await authOptions.callbacks!.jwt!({
      token: { id: "7", status: "active", role: "admin", emailVerified: true },
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: undefined,
    })
    expect(token.status).toBe("blocked")
    expect(token.role).toBe("user")
    expect(token.emailVerified).toBe(false)
  })

  it("refreshes role, plan and verification from the database", async () => {
    prisma.user.findUnique.mockResolvedValue({
      status: "active",
      role: "admin",
      plan: "pro",
      name: "Novo",
      emailVerifiedAt: new Date(),
    })
    const { authOptions } = await import("@/lib/auth")
    const token = await authOptions.callbacks!.jwt!({
      token: { id: "7", status: "active", role: "user", plan: "free", emailVerified: false },
      user: undefined as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: undefined,
    })
    expect(token.role).toBe("admin")
    expect(token.plan).toBe("pro")
    expect(token.name).toBe("Novo")
    expect(token.emailVerified).toBe(true)
  })
})
