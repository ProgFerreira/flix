import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const collectionForMember = vi.fn((c: { id: number }, userId: number) => ({ ...c, myRole: "owner", viewerId: userId }))

const prisma = {
  collection: { findMany: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/collection-share", () => ({
  collectionForMember: (...args: unknown[]) => collectionForMember(...args as [ { id: number }, number ]),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/collections", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    collectionForMember.mockClear()
    prisma.collection.findMany.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/collections/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("lists collections the user belongs to", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collection.findMany.mockResolvedValue([{ id: 1, name: "Estudos", members: [] }])
    const { GET } = await import("@/app/api/collections/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prisma.collection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { members: { some: { userId: 7 } } },
    }))
    expect(collectionForMember).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 7)
  })
})

describe("POST /api/collections", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collection.create.mockReset()
  })

  it("returns 400 for an empty name", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { POST } = await import("@/app/api/collections/route")
    const res = await POST(new NextRequest("http://localhost/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  " }),
    }))
    expect(res.status).toBe(400)
    expect(prisma.collection.create).not.toHaveBeenCalled()
  })

  it("creates a collection with the requester as owner", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.collection.create.mockResolvedValue({ id: 3, name: "Estudos", members: [{ userId: 7, role: "owner" }] })
    const { POST } = await import("@/app/api/collections/route")
    const res = await POST(new NextRequest("http://localhost/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Estudos" }),
    }))
    expect(res.status).toBe(200)
    expect(prisma.collection.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        name: "Estudos",
        ownerId: 7,
        members: { create: { userId: 7, role: "owner" } },
      },
    }))
    const json = await res.json()
    expect(json.id).toBe(3)
    expect(json.myRole).toBe("owner")
  })
})
