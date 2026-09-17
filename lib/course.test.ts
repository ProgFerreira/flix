import { describe, it, expect } from "vitest"
import {
  slugifyCourseTitle,
  uniqueCourseSlug,
  isLessonComplete,
  courseProgressPercent,
  summarizeCourseProgress,
  pickContinueLesson,
  courseCover,
  isEligibleCourseLesson,
  mergeLessonSeconds,
  parseLearnings,
  isArticleSource,
} from "@/lib/course"

describe("slugifyCourseTitle", () => {
  it("strips accents and punctuation", () => {
    expect(slugifyCourseTitle("Módulo 1: Introdução")).toBe("modulo-1-introducao")
  })

  it("falls back when the title has no letters", () => {
    expect(slugifyCourseTitle("!!!")).toBe("curso")
  })
})

describe("uniqueCourseSlug", () => {
  it("keeps the base when it is free", () => {
    expect(uniqueCourseSlug("curso", ["outro"])).toBe("curso")
  })

  it("appends the next free suffix", () => {
    expect(uniqueCourseSlug("curso", ["curso", "curso-2"])).toBe("curso-3")
  })
})

describe("isLessonComplete", () => {
  it("requires ~90% of a known duration", () => {
    expect(isLessonComplete(539, "10:00")).toBe(false)
    expect(isLessonComplete(540, "10:00")).toBe(true)
  })

  it("does not complete lessons without duration", () => {
    expect(isLessonComplete(400, null)).toBe(false)
    expect(isLessonComplete(0, "10:00")).toBe(false)
  })

  it("completes a written lesson at the sentinel duration", () => {
    expect(isLessonComplete(60, "1:00")).toBe(true)
  })
})

describe("isArticleSource", () => {
  it("recognizes written lessons", () => {
    expect(isArticleSource("article")).toBe(true)
    expect(isArticleSource("upload")).toBe(false)
    expect(isArticleSource(undefined)).toBe(false)
  })
})

describe("courseProgressPercent", () => {
  it("returns null without eligible lessons", () => {
    expect(courseProgressPercent(0, 0)).toBeNull()
  })

  it("rounds completed over total", () => {
    expect(courseProgressPercent(1, 2)).toBe(50)
    expect(courseProgressPercent(2, 2)).toBe(100)
  })
})

describe("summarizeCourseProgress", () => {
  it("ignores drafts and unfinished uploads", () => {
    const summary = summarizeCourseProgress(
      [
        { id: 1, duration: "10:00", published: true, status: "ready" },
        { id: 2, duration: "10:00", published: false, status: "ready" },
        { id: 3, duration: "10:00", published: true, status: "processing" },
      ],
      new Map([[1, 540], [2, 540], [3, 540]]),
    )
    expect(summary).toEqual({ completed: 1, total: 1, percent: 100 })
  })
})

describe("pickContinueLesson", () => {
  const lessons = [
    { id: 1, duration: "10:00", published: true, status: "ready" },
    { id: 2, duration: "10:00", published: true, status: "ready" },
    { id: 3, duration: "10:00", published: true, status: "ready" },
  ]

  it("returns the first incomplete lesson when nothing was started", () => {
    expect(pickContinueLesson(lessons, new Map())?.id).toBe(1)
  })

  it("returns the most recently updated incomplete lesson", () => {
    const picked = pickContinueLesson(lessons, new Map([
      [1, { seconds: 40, updatedAt: 10 }],
      [2, { seconds: 80, updatedAt: 50 }],
    ]))
    expect(picked?.id).toBe(2)
  })

  it("falls back to the first lesson when the course is done", () => {
    const picked = pickContinueLesson(lessons, new Map([
      [1, { seconds: 540, updatedAt: 1 }],
      [2, { seconds: 540, updatedAt: 2 }],
      [3, { seconds: 540, updatedAt: 3 }],
    ]))
    expect(picked?.id).toBe(1)
  })
})

describe("mergeLessonSeconds", () => {
  it("keeps the same object when the floored seconds did not change", () => {
    const prev = { 1: 12 }
    expect(mergeLessonSeconds(prev, 1, 12.9)).toBe(prev)
  })

  it("returns a new map when progress advances", () => {
    const prev = { 1: 12 }
    expect(mergeLessonSeconds(prev, 1, 13)).toEqual({ 1: 13 })
  })

  it("does not insert a zero when the lesson had no stored seconds", () => {
    const prev: Record<number, number> = {}
    expect(mergeLessonSeconds(prev, 1, 0.4)).toBe(prev)
  })
})

describe("isEligibleCourseLesson / courseCover", () => {
  it("requires published and ready", () => {
    expect(isEligibleCourseLesson({ published: true, status: "ready" })).toBe(true)
    expect(isEligibleCourseLesson({ published: true, status: "error" })).toBe(false)
  })

  it("prefers the course thumbnail then the first lesson", () => {
    expect(courseCover("capa.jpg", "aula.jpg")).toBe("capa.jpg")
    expect(courseCover(null, "aula.jpg")).toBe("aula.jpg")
    expect(courseCover(null, null)).toBe("/video-placeholder.svg")
    expect(courseCover("/video-placeholder.svg", "aula.jpg")).toBe("aula.jpg")
  })
})

describe("parseLearnings", () => {
  it("returns nothing for empty notes", () => {
    expect(parseLearnings(null)).toEqual([])
    expect(parseLearnings("  ")).toEqual([])
  })

  it("strips bullets and keeps one item per line", () => {
    expect(parseLearnings("- Instalar o Cursor\n* Criar prompts\n3. Navegar na interface")).toEqual([
      "Instalar o Cursor",
      "Criar prompts",
      "Navegar na interface",
    ])
  })
})
