import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
  computeSubscriptionStatus: () => "active",
}))

const prisma = {
  user: { create: vi.fn() },
}
vi.mock("@/lib/prisma", () => ({ prisma }))

const applyPlanChange = vi.fn()
vi.mock("@/lib/admin-users", () => ({
  applyPlanChange: (...args: unknown[]) => applyPlanChange(...args),
}))

const logAdminAction = vi.fn()
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.user.create.mockReset()
    applyPlanChange.mockReset()
    logAdminAction.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/users/route")
    const res = await POST(post({ name: "Ana", email: "ana@flix.test", password: "senha123" }))
    expect(res.status).toBe(403)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid WhatsApp number", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { POST } = await import("@/app/api/admin/users/route")
    const res = await POST(post({
      name: "Ana",
      email: "ana@flix.test",
      password: "senha123",
      phone: "123",
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/WhatsApp inválido/)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it("creates a user with a normalized phone", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.user.create.mockResolvedValue({
      id: 42,
      email: "ana@flix.test",
      name: "Ana",
      phone: "5511994999859",
      role: "user",
      plan: "free",
      status: "active",
      createdAt: new Date(),
      emailVerifiedAt: new Date(),
    })
    const { POST } = await import("@/app/api/admin/users/route")
    const res = await POST(post({
      name: "Ana",
      email: "ana@flix.test",
      password: "senha123",
      phone: "11 99499-9859",
      plan: "free",
      role: "user",
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe(42)
    expect(json.phone).toBe("5511994999859")
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "ana@flix.test",
        name: "Ana",
        phone: "5511994999859",
        plan: "free",
        role: "user",
      }),
    }))
    expect(applyPlanChange).not.toHaveBeenCalled()
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 1,
      action: "user.create",
      targetId: 42,
    }))
  })

  it("creates a user without phone when the field is empty", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.user.create.mockResolvedValue({
      id: 43,
      email: "bob@flix.test",
      name: "Bob",
      phone: null,
      role: "user",
      plan: "free",
      status: "active",
      createdAt: new Date(),
      emailVerifiedAt: new Date(),
    })
    const { POST } = await import("@/app/api/admin/users/route")
    const res = await POST(post({
      name: "Bob",
      email: "bob@flix.test",
      password: "senha123",
      phone: "",
    }))
    expect(res.status).toBe(201)
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phone: null }),
    }))
  })
})
