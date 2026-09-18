import { describe, it, expect, vi, beforeEach } from "vitest"

const optionalUserId = vi.fn()
const optionalCatalogRequester = vi.fn()
const syncSubscriptionStatus = vi.fn()
const grantedVideoIdsForUser = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  course: { findUnique: vi.fn(), findMany: vi.fn() },
  watchProgress: { findMany: vi.fn() },
  courseFavorite: { findUnique: vi.fn() },
  courseReview: { findMany: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    optionalUserId: (...args: unknown[]) => optionalUserId(...args),
    syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
  }
})
vi.mock("@/lib/catalog-requester", () => ({
  optionalCatalogRequester: (...args: unknown[]) => optionalCatalogRequester(...args),
}))
vi.mock("@/lib/video-grants", () => ({
  grantedVideoIdsForUser: (...args: unknown[]) => grantedVideoIdsForUser(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

const publishedCourse = {
  id: 4,
  title: "Corte",
  slug: "corte",
  description: null,
  learnings: null,
  thumbnail: null,
  requiredPlan: "free",
  published: true,
  sortOrder: 0,
  modules: [],
}

describe("loadPublicCourseBySlug", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    optionalCatalogRequester.mockReset()
    syncSubscriptionStatus.mockReset()
    grantedVideoIdsForUser.mockReset()
    prisma.user.findUnique.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.course.findMany.mockReset()
    prisma.watchProgress.findMany.mockReset()
    prisma.courseFavorite.findUnique.mockReset()
    prisma.courseReview.findMany.mockReset()
    prisma.course.findUnique.mockResolvedValue(publishedCourse)
    prisma.course.findMany.mockResolvedValue([])
    prisma.courseFavorite.findUnique.mockResolvedValue(null)
    prisma.courseReview.findMany.mockResolvedValue([])
    optionalCatalogRequester.mockResolvedValue(null)
    optionalUserId.mockResolvedValue(null)
  })

  it("starts the course query without waiting for the catalog requester", async () => {
    let release: (value: null) => void = () => undefined
    const pending = new Promise<null>((resolve) => {
      release = resolve
    })
    optionalUserId.mockReturnValue(pending)
    optionalCatalogRequester.mockReturnValue(pending)

    const { loadPublicCourseBySlug } = await import("@/lib/load-public-course")
    const resultPromise = loadPublicCourseBySlug("corte")
    await vi.waitFor(() => expect(prisma.course.findUnique).toHaveBeenCalled())
    release(null)
    await expect(resultPromise).resolves.toMatchObject({ slug: "corte" })
  })

  it("attaches favorite, reviews and related courses for a logged-in student", async () => {
    optionalCatalogRequester.mockResolvedValue({ userId: 7, plan: "premium", role: "user" })
    prisma.course.findUnique.mockResolvedValue({
      ...publishedCourse,
      requiredPlan: "premium",
      updatedAt: new Date("2026-09-18T12:00:00.000Z"),
    })
    prisma.courseFavorite.findUnique.mockResolvedValue({ id: 1, userId: 7, courseId: 4 })
    prisma.courseReview.findMany.mockResolvedValue([
      {
        id: 9,
        rating: 5,
        comment: "Gostei",
        createdAt: new Date("2026-09-18T12:00:00.000Z"),
        userId: 7,
        user: { name: "Ana" },
      },
    ])
    prisma.course.findMany.mockResolvedValue([
      {
        id: 5,
        title: "Costura",
        slug: "costura",
        description: null,
        thumbnail: null,
        requiredPlan: "premium",
        published: true,
        sortOrder: 1,
        modules: [],
      },
    ])

    const { loadPublicCourseBySlug } = await import("@/lib/load-public-course")
    const result = await loadPublicCourseBySlug("corte")
    expect(result).toMatchObject({
      slug: "corte",
      favorited: true,
      reviews: { count: 1, average: 5, mine: { rating: 5, comment: "Gostei" } },
      related: [{ slug: "costura" }],
    })
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ published: true, id: { not: 4 }, requiredPlan: "premium" }),
      take: 4,
    }))
  })
})
