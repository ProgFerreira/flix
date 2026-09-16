import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/account/export", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/account/export/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("downloads a JSON copy without the password hash", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: "eu@flix.test",
      name: "Rener",
      phone: null,
      plan: "free",
      role: "user",
      status: "active",
      createdAt: new Date("2026-01-01"),
      emailVerifiedAt: null,
      consentimentos: [],
      subscription: null,
      payments: [{ id: 1, plan: "premium", billing: "monthly", amount: { toString: () => "10.00" }, method: "pix", createdAt: new Date() }],
      videos: [],
    })
    const { GET } = await import("@/app/api/account/export/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Disposition")).toMatch(/flix-dados-7\.json/)
    const json = await res.json()
    expect(json.email).toBe("eu@flix.test")
    expect(json.payments[0].amount).toBe("10.00")
    expect(json).not.toHaveProperty("password")
  })
})
