import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const optionalUserId = vi.fn()
const syncSubscriptionStatus = vi.fn()
const canAccessCatalogVideo = vi.fn()
const grantedVideoIdsForUser = vi.fn()

const prisma = {
  user: { findUnique: vi.fn() },
  course: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  watchProgress: { findMany: vi.fn() },
}

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>()
  return {
    ...actual,
    optionalUserId: (...args: unknown[]) => optionalUserId(...args),
    syncSubscriptionStatus: (...args: unknown[]) => syncSubscriptionStatus(...args),
    canAccessCatalogVideo: (...args: unknown[]) => canAccessCatalogVideo(...args),
  }
})
vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    grantedVideoIdsForUser: (...args: unknown[]) => grantedVideoIdsForUser(...args),
  }
})
vi.mock("@/lib/prisma", () => ({ prisma }))

const freeLesson = {
  sortOrder: 0,
  video: {
    id: 11,
    title: "Aula 1",
    thumbnail: "t.jpg",
    duration: "10:00",
    channelName: "Canal",
    source: "youtube" as const,
    videoId: "abcdefghijk",
    published: true,
    status: "ready",
    requiredPlan: "free",
    userId: 1,
    previewPath: null,
    filePath: null,
    playbackPath: null,
    notes: "Texto da aula",
  },
}

describe("GET /api/catalog/courses", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    prisma.course.count.mockReset()
    prisma.course.findMany.mockReset()
    prisma.watchProgress.findMany.mockReset()
    prisma.user.findUnique.mockReset()
  })

  it("limits the default course rail to plans the visitor already has", async () => {
    optionalUserId.mockResolvedValue(null)
    prisma.course.count.mockResolvedValue(0)
    prisma.course.findMany.mockResolvedValue([])
    const { GET } = await import("@/app/api/catalog/courses/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses"))
    expect(res.status).toBe(200)
    expect(prisma.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ published: true, requiredPlan: { in: ["free"] } }),
    }))
  })

  it("lists a paid course chip as locked for visitors", async () => {
    optionalUserId.mockResolvedValue(null)
    prisma.course.count.mockResolvedValue(1)
    prisma.course.findMany.mockResolvedValue([{
      id: 4,
      title: "Corte",
      slug: "corte",
      description: null,
      thumbnail: null,
      requiredPlan: "premium",
      published: true,
      sortOrder: 0,
      modules: [{ id: 1, title: "Início", sortOrder: 0, lessons: [freeLesson] }],
    }])
    const { GET } = await import("@/app/api/catalog/courses/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses?plan=premium"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items[0].slug).toBe("corte")
    expect(json.items[0].locked).toBe(true)
    expect(json.items[0].lessonCount).toBe(1)
    expect(json.items[0].thumbnail).toBe("t.jpg")
  })
})

describe("GET /api/catalog/courses/[slug]", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.user.findUnique.mockReset()
    canAccessCatalogVideo.mockReset()
    grantedVideoIdsForUser.mockReset()
    prisma.watchProgress.findMany.mockReset()
  })

  it("returns 404 for an invalid slug", async () => {
    const { GET } = await import("@/app/api/catalog/courses/[slug]/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/Nope"), {
      params: Promise.resolve({ slug: "Nope" }),
    })
    expect(res.status).toBe(404)
    expect(prisma.course.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 for an unpublished course", async () => {
    optionalUserId.mockResolvedValue(null)
    prisma.course.findUnique.mockResolvedValue({
      id: 4,
      title: "Rascunho",
      slug: "rascunho",
      description: null,
      thumbnail: null,
      requiredPlan: "free",
      published: false,
      sortOrder: 0,
      modules: [],
    })
    const { GET } = await import("@/app/api/catalog/courses/[slug]/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/rascunho"), {
      params: Promise.resolve({ slug: "rascunho" }),
    })
    expect(res.status).toBe(404)
  })

  it("returns the curriculum for a published course", async () => {
    optionalUserId.mockResolvedValue(null)
    canAccessCatalogVideo.mockReturnValue(true)
    prisma.course.findUnique.mockResolvedValue({
      id: 4,
      title: "Corte",
      slug: "corte",
      description: "Trilha",
      learnings: "- Cortar\n- Costurar",
      thumbnail: null,
      requiredPlan: "free",
      published: true,
      sortOrder: 0,
      modules: [{ id: 1, title: "Início", sortOrder: 0, lessons: [freeLesson] }],
    })
    const { GET } = await import("@/app/api/catalog/courses/[slug]/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/corte"), {
      params: Promise.resolve({ slug: "corte" }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.modules[0].title).toBe("Início")
    expect(json.modules[0].lessons[0].title).toBe("Aula 1")
    expect(json.modules[0].lessons[0].notes).toBe("Texto da aula")
    expect(json.learnings).toEqual(["Cortar", "Costurar"])
    expect(json.modules[0].lessons[0]).not.toHaveProperty("filePath")
  })

  it("hides notes on locked lessons", async () => {
    optionalUserId.mockResolvedValue(null)
    canAccessCatalogVideo.mockReturnValue(false)
    prisma.course.findUnique.mockResolvedValue({
      id: 4,
      title: "Corte",
      slug: "corte",
      description: "Trilha",
      thumbnail: null,
      requiredPlan: "premium",
      published: true,
      sortOrder: 0,
      modules: [{ id: 1, title: "Início", sortOrder: 0, lessons: [freeLesson] }],
    })
    const { GET } = await import("@/app/api/catalog/courses/[slug]/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/courses/corte"), {
      params: Promise.resolve({ slug: "corte" }),
    })
    const json = await res.json()
    expect(json.modules[0].lessons[0].locked).toBe(true)
    expect(json.modules[0].lessons[0].notes).toBeNull()
  })
})
