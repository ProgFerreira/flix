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
  hasCustomThumb,
  formatCourseDuration,
  sumLessonDurations,
  courseLandingChips,
  moduleCurriculumMeta,
  lessonKindLabel,
  courseLandingPreviewHints,
  courseLandingCta,
  courseLandingLessonState,
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

describe("hasCustomThumb", () => {
  it("treats empty and placeholder as no custom image", () => {
    expect(hasCustomThumb(null)).toBe(false)
    expect(hasCustomThumb("")).toBe(false)
    expect(hasCustomThumb("/video-placeholder.svg")).toBe(false)
  })

  it("accepts stored lesson and catalog thumbs", () => {
    expect(hasCustomThumb("/api/videos/44/thumbnail")).toBe(true)
    expect(hasCustomThumb("https://img.youtube.com/vi/x/hqdefault.jpg")).toBe(true)
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

describe("formatCourseDuration", () => {
  it("returns empty when there is no usable time", () => {
    expect(formatCourseDuration(0)).toBe("")
    expect(formatCourseDuration(-10)).toBe("")
    expect(formatCourseDuration(Number.NaN)).toBe("")
  })

  it("uses minutes for short totals and hours when needed", () => {
    expect(formatCourseDuration(45)).toBe("< 1 min")
    expect(formatCourseDuration(125)).toBe("2 min")
    expect(formatCourseDuration(53 * 60)).toBe("53 min")
    expect(formatCourseDuration(3600)).toBe("1h")
    expect(formatCourseDuration(3723)).toBe("1h 2min")
  })
})

describe("sumLessonDurations", () => {
  it("adds clock durations and ignores empty ones", () => {
    expect(sumLessonDurations([
      { duration: "10:00" },
      { duration: null },
      { duration: "1:02:03" },
    ])).toBe(10 * 60 + 3723)
  })
})

describe("courseLandingChips", () => {
  it("lists aulas, módulos and total duration", () => {
    expect(courseLandingChips({ lessonCount: 2, moduleCount: 1, totalSeconds: 53 * 60 })).toEqual([
      "2 aulas",
      "1 módulo",
      "53 min",
    ])
  })

  it("singularizes and omits duration when unknown", () => {
    expect(courseLandingChips({ lessonCount: 1, moduleCount: 2, totalSeconds: 0 })).toEqual([
      "1 aula",
      "2 módulos",
    ])
  })
})

describe("moduleCurriculumMeta", () => {
  it("joins lesson count with the module duration", () => {
    expect(moduleCurriculumMeta([
      { duration: "10:00" },
      { duration: "5:00" },
    ])).toBe("2 aulas · 15 min")
  })

  it("keeps only the count when durations are missing", () => {
    expect(moduleCurriculumMeta([{ duration: null }])).toBe("1 aula")
  })
})

describe("lessonKindLabel", () => {
  it("labels written lessons as artigo and the rest as vídeo", () => {
    expect(lessonKindLabel("article")).toBe("Artigo")
    expect(lessonKindLabel("youtube")).toBe("Vídeo")
    expect(lessonKindLabel("upload")).toBe("Vídeo")
  })
})

describe("courseLandingPreviewHints", () => {
  it("lists missing cover, description and learnings for admin preview", () => {
    expect(courseLandingPreviewHints({
      thumbnail: "/video-placeholder.svg",
      description: null,
      learnings: [],
    }).map((hint) => hint.field)).toEqual(["thumbnail", "description", "learnings"])
  })

  it("returns nothing when the landing already has content", () => {
    expect(courseLandingPreviewHints({
      thumbnail: "/api/videos/1/thumbnail",
      description: "Curso completo",
      learnings: ["Instalar o Cursor"],
    })).toEqual([])
  })

  it("tells the admin to fill the description in the editor", () => {
    const hint = courseLandingPreviewHints({
      thumbnail: "capa.jpg",
      description: "  ",
      learnings: ["A"],
    }).find((item) => item.field === "description")
    expect(hint?.message).toBe("Preencha a descrição no editor para esta seção aparecer.")
  })
})

describe("courseLandingCta", () => {
  it("asks visitors to sign in when the course is locked", () => {
    expect(courseLandingCta({
      locked: true,
      isLoggedIn: false,
      requiredPlan: "premium",
      hasProgress: false,
      hasPlayableLesson: true,
    })).toEqual({ kind: "upgrade", label: "Entrar pra assinar" })
  })

  it("asks subscribers to upgrade to the required plan", () => {
    expect(courseLandingCta({
      locked: true,
      isLoggedIn: true,
      requiredPlan: "pro",
      hasProgress: false,
      hasPlayableLesson: true,
    })).toEqual({ kind: "upgrade", label: "Assinar Pro" })
  })

  it("starts or continues when the student can play a lesson", () => {
    expect(courseLandingCta({
      locked: false,
      isLoggedIn: true,
      requiredPlan: "free",
      hasProgress: false,
      hasPlayableLesson: true,
    })).toEqual({ kind: "start", label: "Iniciar curso" })
    expect(courseLandingCta({
      locked: false,
      isLoggedIn: true,
      requiredPlan: "free",
      hasProgress: true,
      hasPlayableLesson: true,
    })).toEqual({ kind: "start", label: "Continuar" })
  })

  it("falls back when there is no playable lesson", () => {
    expect(courseLandingCta({
      locked: false,
      isLoggedIn: true,
      requiredPlan: "free",
      hasProgress: false,
      hasPlayableLesson: false,
    })).toEqual({ kind: "empty", label: "Este curso ainda não tem aulas" })
  })
})

describe("courseLandingLessonState", () => {
  it("locks processing, error and plan-gated lessons", () => {
    expect(courseLandingLessonState({ locked: true, status: "ready", progressSeconds: 0, duration: "10:00" })).toBe("locked")
    expect(courseLandingLessonState({ locked: false, status: "processing", progressSeconds: 0, duration: "10:00" })).toBe("locked")
    expect(courseLandingLessonState({ locked: false, status: "error", progressSeconds: 0, duration: "10:00" })).toBe("locked")
  })

  it("marks a finished lesson as done and the rest as playable", () => {
    expect(courseLandingLessonState({ locked: false, status: "ready", progressSeconds: 540, duration: "10:00" })).toBe("done")
    expect(courseLandingLessonState({ locked: false, status: "ready", progressSeconds: 10, duration: "10:00" })).toBe("playable")
  })
})
