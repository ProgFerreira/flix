import { describe, it, expect, vi, beforeEach } from "vitest"

const optionalUserId = vi.fn()
const optionalCatalogRequester = vi.fn()
const syncSubscriptionStatus = vi.fn()
const grantedVideoIdsForUser = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  course: { findUnique: vi.fn() },
  watchProgress: { findMany: vi.fn() },
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
    prisma.watchProgress.findMany.mockReset()
    prisma.course.findUnique.mockResolvedValue(publishedCourse)
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
})
