import { describe, it, expect } from "vitest"
import {
  courseWriteSchema,
  coursePatchSchema,
  curriculumSchema,
  courseSlugSchema,
  courseReviewWriteSchema,
} from "@/validators/course"

describe("courseWriteSchema", () => {
  it("accepts a title without forcing plan defaults on the payload", () => {
    const parsed = courseWriteSchema.parse({ title: "Trilha de corte" })
    expect(parsed.requiredPlan).toBeUndefined()
    expect(parsed.published).toBeUndefined()
    expect(parsed.description).toBeUndefined()
    expect(parsed.learnings).toBeUndefined()
  })

  it("rejects an invalid slug", () => {
    const parsed = courseWriteSchema.safeParse({ title: "Aula", slug: "Módulo 1" })
    expect(parsed.success).toBe(false)
  })
})

describe("courseWriteSchema landing metadata", () => {
  it("accepts optional instructor, level, lists, faq and trailer", () => {
    const parsed = courseWriteSchema.parse({
      title: "Trilha",
      instructorName: "Rener",
      level: "beginner",
      requirements: "Ter um cadastro",
      audience: "Quem está começando",
      faq: "Tem certificado?\nAinda não.",
      trailerVideoId: 11,
    })
    expect(parsed.instructorName).toBe("Rener")
    expect(parsed.level).toBe("beginner")
    expect(parsed.requirements).toBe("Ter um cadastro")
    expect(parsed.audience).toBe("Quem está começando")
    expect(parsed.faq).toBe("Tem certificado?\nAinda não.")
    expect(parsed.trailerVideoId).toBe(11)
  })

  it("clears instructor, level and trailer when blank", () => {
    const parsed = courseWriteSchema.parse({
      title: "Trilha",
      instructorName: "  ",
      trailerVideoId: null,
      level: null,
    })
    expect(parsed.instructorName).toBeNull()
    expect(parsed.trailerVideoId).toBeNull()
    expect(parsed.level).toBeNull()
  })

  it("rejects an invalid level", () => {
    expect(courseWriteSchema.safeParse({ title: "A", level: "expert" }).success).toBe(false)
  })
})

describe("courseReviewWriteSchema", () => {
  it("accepts a rating and optional comment", () => {
    expect(courseReviewWriteSchema.parse({ rating: 5, comment: "  Ótimo  " })).toEqual({
      rating: 5,
      comment: "Ótimo",
    })
  })

  it("clears a blank comment and rejects ratings outside 1-5", () => {
    expect(courseReviewWriteSchema.parse({ rating: 1, comment: "   " })).toEqual({
      rating: 1,
      comment: null,
    })
    expect(courseReviewWriteSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(courseReviewWriteSchema.safeParse({ rating: 6 }).success).toBe(false)
  })
})

describe("coursePatchSchema", () => {
  it("keeps published true without requiring a title", () => {
    expect(coursePatchSchema.parse({ published: true })).toEqual({ published: true })
  })
})

describe("courseSlugSchema", () => {
  it("accepts hyphenated lowercase slugs", () => {
    expect(courseSlugSchema.parse("modulo-1-introducao")).toBe("modulo-1-introducao")
  })
})

describe("curriculumSchema", () => {
  it("rejects a blank module title", () => {
    expect(curriculumSchema.safeParse({ modules: [{ title: "  ", lessons: [] }] }).success).toBe(false)
  })

  it("keeps module and lesson order from the array", () => {
    const parsed = curriculumSchema.parse({
      modules: [
        { title: "Início", lessons: [{ videoId: 3 }, { videoId: 1 }] },
      ],
    })
    expect(parsed.modules[0]?.lessons.map((lesson) => lesson.videoId)).toEqual([3, 1])
  })
})
