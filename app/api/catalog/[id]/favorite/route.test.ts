import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const resolveCatalogAccess = vi.fn()

const prisma = {
  favorite: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/catalog-access", () => ({
  resolveCatalogAccess: (...args: unknown[]) => resolveCatalogAccess(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("PATCH /api/catalog/[id]/favorite", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    resolveCatalogAccess.mockReset()
    prisma.favorite.findUnique.mockReset()
    prisma.favorite.delete.mockReset()
    prisma.favorite.create.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PATCH } = await import("@/app/api/catalog/[id]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/5/favorite"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 404 for a non-numeric id", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { PATCH } = await import("@/app/api/catalog/[id]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/x/favorite"), {
      params: Promise.resolve({ id: "x" }),
    })
    expect(res.status).toBe(404)
    expect(resolveCatalogAccess).not.toHaveBeenCalled()
  })

  it("forwards a catalog-access denial", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    resolveCatalogAccess.mockResolvedValue({
      error: NextResponse.json({ error: "Sua assinatura não dá acesso a este vídeo" }, { status: 403 }),
    })
    const { PATCH } = await import("@/app/api/catalog/[id]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/5/favorite"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(403)
  })

  it("favorites when there is no existing row", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    resolveCatalogAccess.mockResolvedValue({ video: { id: 5 } })
    prisma.favorite.findUnique.mockResolvedValue(null)
    const { PATCH } = await import("@/app/api/catalog/[id]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/5/favorite"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(200)
    expect(prisma.favorite.create).toHaveBeenCalledWith({ data: { userId: 7, videoId: 5 } })
    expect(await res.json()).toEqual({ favorited: true })
  })

  it("unfavorites when the row already exists", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    resolveCatalogAccess.mockResolvedValue({ video: { id: 5 } })
    prisma.favorite.findUnique.mockResolvedValue({ id: 99 })
    const { PATCH } = await import("@/app/api/catalog/[id]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/5/favorite"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(200)
    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: 99 } })
    expect(await res.json()).toEqual({ favorited: false })
  })
})
