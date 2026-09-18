import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const optionalCatalogRequester = vi.fn()
const checkRateLimit = vi.fn()

const prisma = {
  course: { findUnique: vi.fn() },
  courseReview: { findMany: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    requireUserId: (...args: unknown[]) => requireUserId(...args),
  }
})
vi.mock("@/lib/catalog-requester", () => ({
  optionalCatalogRequester: (...args: unknown[]) => optionalCatalogRequester(...args),
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

const params = { params: Promise.resolve({ slug: "corte" }) }

describe("GET /api/catalog/courses/[slug]/reviews", () => {
  beforeEach(() => {
    optionalCatalogRequester.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.courseReview.findMany.mockReset()
    optionalCatalogRequester.mockResolvedValue(null)
  })

  it("returns 404 for an unpublished course", async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: false, requiredPlan: "free" })
    const { GET } = await import("@/app/api/catalog/courses/[slug]/reviews/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/corte/reviews"), params)
    expect(res.status).toBe(404)
  })

  it("lists public reviews without exposing e-mail", async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: true, requiredPlan: "free" })
    prisma.courseReview.findMany.mockResolvedValue([
      {
        id: 1,
        rating: 5,
        comment: "Ótimo",
        createdAt: new Date("2026-09-18T12:00:00.000Z"),
        userId: 7,
        user: { name: "Ana" },
      },
    ])
    const { GET } = await import("@/app/api/catalog/courses/[slug]/reviews/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/corte/reviews"), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      count: 1,
      average: 5,
      items: [{ authorName: "Ana", rating: 5 }],
    })
  })
})

describe("PUT /api/catalog/courses/[slug]/reviews", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    optionalCatalogRequester.mockReset()
    checkRateLimit.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.courseReview.upsert.mockReset()
    prisma.user.findUnique.mockReset()
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    optionalCatalogRequester.mockResolvedValue({ userId: 7, plan: "premium", role: "user" })
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PUT } = await import("@/app/api/catalog/courses/[slug]/reviews/route")
    const res = await PUT(new NextRequest("http://localhost/api/catalog/courses/corte/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }), params)
    expect(res.status).toBe(401)
  })

  it("rejects a locked student", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    optionalCatalogRequester.mockResolvedValue({ userId: 7, plan: "free", role: "user" })
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: true, requiredPlan: "premium" })
    const { PUT } = await import("@/app/api/catalog/courses/[slug]/reviews/route")
    const res = await PUT(new NextRequest("http://localhost/api/catalog/courses/corte/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }), params)
    expect(res.status).toBe(403)
    expect(prisma.courseReview.upsert).not.toHaveBeenCalled()
  })

  it("upserts the student's review", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, published: true, requiredPlan: "premium" })
    prisma.courseReview.upsert.mockResolvedValue({
      id: 1,
      rating: 4,
      comment: "Bom",
      createdAt: new Date("2026-09-18T12:00:00.000Z"),
      userId: 7,
      user: { name: "Ana" },
    })
    prisma.courseReview.findMany.mockResolvedValue([
      {
        id: 1,
        rating: 4,
        comment: "Bom",
        createdAt: new Date("2026-09-18T12:00:00.000Z"),
        userId: 7,
        user: { name: "Ana" },
      },
    ])
    const { PUT } = await import("@/app/api/catalog/courses/[slug]/reviews/route")
    const res = await PUT(new NextRequest("http://localhost/api/catalog/courses/corte/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 4, comment: "Bom" }),
    }), params)
    expect(res.status).toBe(200)
    expect(prisma.courseReview.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_courseId: { userId: 7, courseId: 4 } },
      create: expect.objectContaining({ userId: 7, courseId: 4, rating: 4, comment: "Bom" }),
      update: expect.objectContaining({ rating: 4, comment: "Bom" }),
    }))
    expect(await res.json()).toMatchObject({ count: 1, mine: { rating: 4, comment: "Bom" } })
  })
})
