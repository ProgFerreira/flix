import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const prisma = {
  adminAuditLog: { count: vi.fn(), findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/admin/audit", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.adminAuditLog.count.mockReset()
    prisma.adminAuditLog.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/audit/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/audit"))
    expect(res.status).toBe(403)
  })

  it("returns a paginated audit log", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.adminAuditLog.count.mockResolvedValue(1)
    prisma.adminAuditLog.findMany.mockResolvedValue([{
      id: 1,
      action: "user.create",
      targetType: "user",
      targetId: 7,
      meta: null,
      createdAt: new Date(),
      admin: { id: 1, name: "Admin", email: "a@flix.test" },
    }])
    const { GET } = await import("@/app/api/admin/audit/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/audit"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toHaveLength(1)
    expect(json.items[0].action).toBe("user.create")
  })
})
