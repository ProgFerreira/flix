import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  collectionMember: { findUnique: vi.fn() },
  collection: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/collection-share", () => ({
  newShareToken: () => "new-public-share-token-ok",
}))

describe("PATCH /api/collections/[id]", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.collectionMember.findUnique.mockReset()
    prisma.collection.findUnique.mockReset()
    prisma.collection.update.mockReset()
  })

  it("returns 401 without a session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PATCH } = await import("@/app/api/collections/[id]/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/collections/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("forbids a viewer from toggling the public link", async () => {
    requireUserId.mockResolvedValue({ userId: 2 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "viewer", userId: 2 })
    const { PATCH } = await import("@/app/api/collections/[id]/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/collections/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("generates a share token when the owner turns the collection public", async () => {
    requireUserId.mockResolvedValue({ userId: 1 })
    prisma.collectionMember.findUnique.mockResolvedValue({ role: "owner", userId: 1 })
    prisma.collection.findUnique.mockResolvedValue({ shareToken: null })
    prisma.collection.update.mockResolvedValue({
      id: 1, name: "Estudos", isPublic: true, shareToken: "new-public-share-token-ok",
    })
    const { PATCH } = await import("@/app/api/collections/[id]/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/collections/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: true }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.collection.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublic: true, shareToken: "new-public-share-token-ok" },
    })
  })
})
