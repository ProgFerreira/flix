import { describe, it, expect } from "vitest"
import { courseWriteSchema, coursePatchSchema, curriculumSchema, courseSlugSchema } from "@/validators/course"

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
