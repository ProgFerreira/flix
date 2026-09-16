import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  collection: {
    findFirst: vi.fn(),
  },
  collectionMember: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("POST /api/collections/[id]/invite", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collectionMember.findUnique.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/collections/[id]/invite/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/1/invite", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", role: "viewer" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("forbids a viewer from inviting", async () => {
    requireUserId.mockResolvedValue({ userId: 2 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "viewer", userId: 2 })
    const { POST } = await import("@/app/api/collections/[id]/invite/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/1/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", role: "viewer" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("lets an owner invite a viewer", async () => {
    requireUserId.mockResolvedValue({ userId: 1 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "owner", userId: 1 })
    prisma.user.findUnique.mockResolvedValue({ id: 4, email: "a@b.com", name: "Ana" })
    prisma.collectionMember.upsert.mockResolvedValue({
      userId: 4, role: "viewer", user: { id: 4, email: "a@b.com", name: "Ana" },
    })
    const { POST } = await import("@/app/api/collections/[id]/invite/route")
    const res = await POST(
      new NextRequest("http://localhost/api/collections/1/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", role: "viewer" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(200)
  })
})
