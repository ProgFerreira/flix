import { describe, expect, it } from "vitest"
import { publicCourseDetail, serializeCourseReviews } from "@/lib/course-public"
import type { CourseLessonVideo } from "@/lib/course-query"

const video = (overrides: Partial<CourseLessonVideo> & { id: number; title: string }): CourseLessonVideo => ({
  thumbnail: "t.jpg",
  duration: "10:00",
  channelName: "Canal",
  source: "youtube",
  videoId: "abcdefghijk",
  published: true,
  status: "ready",
  requiredPlan: "free",
  userId: 1,
  notes: "Texto",
  previewPath: null,
  filePath: null,
  playbackPath: null,
  ...overrides,
})

describe("publicCourseDetail", () => {
  it("exposes landing metadata, kind counts, faq and trailer id", () => {
    const detail = publicCourseDetail(
      {
        id: 4,
        title: "Corte",
        slug: "corte",
        description: "Desc",
        learnings: "Cortar tecidos",
        instructorName: "Rener",
        level: "beginner",
        requirements: "Ter um cadastro",
        audience: "Quem está começando",
        faq: "Tem certificado?\nAinda não.",
        trailerVideoId: 11,
        thumbnail: "capa.jpg",
        requiredPlan: "premium",
        published: true,
        sortOrder: 0,
        updatedAt: new Date("2026-09-18T12:00:00.000Z"),
        modules: [{
          id: 1,
          title: "M1",
          sortOrder: 0,
          lessons: [{ sortOrder: 0, video: video({ id: 11, title: "Aula 1" }) }],
        }],
      },
      { plan: "premium", role: "user" },
      7,
      new Map(),
      new Map(),
      new Set(),
    )

    expect(detail.instructorName).toBe("Rener")
    expect(detail.level).toBe("beginner")
    expect(detail.requirements).toEqual(["Ter um cadastro"])
    expect(detail.audience).toEqual(["Quem está começando"])
    expect(detail.faq).toEqual([{ question: "Tem certificado?", answer: "Ainda não." }])
    expect(detail.videoCount).toBe(1)
    expect(detail.articleCount).toBe(0)
    expect(detail.updatedAt).toBe("2026-09-18T12:00:00.000Z")
    expect(detail.updatedAtLabel).toBe("18 set. 2026")
    expect(detail.trailerVideoId).toBe(11)
  })

  it("falls back to the first lesson channel when instructor is empty", () => {
    const detail = publicCourseDetail(
      {
        id: 4,
        title: "Corte",
        slug: "corte",
        description: null,
        thumbnail: null,
        requiredPlan: "free",
        published: true,
        sortOrder: 0,
        updatedAt: new Date("2026-09-18T12:00:00.000Z"),
        instructorName: null,
        trailerVideoId: null,
        modules: [{
          id: 1,
          title: "M1",
          sortOrder: 0,
          lessons: [{ sortOrder: 0, video: video({ id: 11, title: "Aula 1", channelName: "Ateliê" }) }],
        }],
      },
      null,
      null,
      new Map(),
      new Map(),
      new Set(),
    )
    expect(detail.instructorName).toBe("Ateliê")
    expect(detail.trailerVideoId).toBeNull()
  })
})

describe("serializeCourseReviews", () => {
  it("averages ratings and never exposes an e-mail as the author name", () => {
    const serialized = serializeCourseReviews(
      [
        {
          id: 1,
          rating: 5,
          comment: "Ótimo",
          createdAt: new Date("2026-09-18T12:00:00.000Z"),
          userId: 7,
          user: { name: "Ana" },
        },
        {
          id: 2,
          rating: 4,
          comment: null,
          createdAt: new Date("2026-09-17T12:00:00.000Z"),
          userId: 8,
          user: { name: null },
        },
      ],
      7,
    )
    expect(serialized.average).toBe(4.5)
    expect(serialized.count).toBe(2)
    expect(serialized.mine).toEqual({ rating: 5, comment: "Ótimo" })
    expect(serialized.items[1]?.authorName).toBe("Aluno")
    expect(serialized.items[0]?.mine).toBe(true)
  })
})
