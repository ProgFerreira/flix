import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()

const prisma = {
  course: { findUnique: vi.fn() },
  courseFavorite: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

const params = { params: Promise.resolve({ slug: "corte" }) }

describe("PATCH /api/catalog/courses/[slug]/favorite", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.courseFavorite.findUnique.mockReset()
    prisma.courseFavorite.delete.mockReset()
    prisma.courseFavorite.create.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PATCH } = await import("@/app/api/catalog/courses/[slug]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/courses/corte/favorite"), params)
    expect(res.status).toBe(401)
  })

  it("returns 404 for an unpublished course", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: false })
    const { PATCH } = await import("@/app/api/catalog/courses/[slug]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/courses/corte/favorite"), params)
    expect(res.status).toBe(404)
    expect(prisma.courseFavorite.create).not.toHaveBeenCalled()
  })

  it("favorites a published course", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: true })
    prisma.courseFavorite.findUnique.mockResolvedValue(null)
    const { PATCH } = await import("@/app/api/catalog/courses/[slug]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/courses/corte/favorite"), params)
    expect(res.status).toBe(200)
    expect(prisma.courseFavorite.create).toHaveBeenCalledWith({ data: { userId: 7, courseId: 4 } })
    expect(await res.json()).toEqual({ favorited: true })
  })

  it("unfavorites when the row already exists", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: true })
    prisma.courseFavorite.findUnique.mockResolvedValue({ id: 99 })
    const { PATCH } = await import("@/app/api/catalog/courses/[slug]/favorite/route")
    const res = await PATCH(new Request("http://localhost/api/catalog/courses/corte/favorite"), params)
    expect(res.status).toBe(200)
    expect(prisma.courseFavorite.delete).toHaveBeenCalledWith({ where: { id: 99 } })
    expect(await res.json()).toEqual({ favorited: false })
  })
})
