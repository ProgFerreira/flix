import { CONTINUE_DONE_RATIO, CONTINUE_MIN_SECONDS, durationToSeconds } from "@/lib/watch-continue"

export const COURSE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type LessonVideoSource = "youtube" | "upload" | "article"

/** Duração sentinela pra aula de texto contar no progresso do curso. */
export const ARTICLE_LESSON_DURATION = "1:00"
export const ARTICLE_COMPLETE_SECONDS = 60

export function isArticleSource(source: string | null | undefined): source is "article" {
  return source === "article"
}

export function hasCustomThumb(src: string | null | undefined): boolean {
  const value = src?.trim()
  return Boolean(value) && value !== "/video-placeholder.svg"
}

/** Vídeos que já estão numa trilha publicada somem da grade de avulsas. */
export const inPublishedCourseWhere = {
  courseLesson: {
    is: {
      module: {
        is: {
          course: { is: { published: true } },
        },
      },
    },
  },
} as const

export const notInPublishedCourseWhere = {
  NOT: inPublishedCourseWhere,
} as const

export function slugifyCourseTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return slug || "curso"
}

export function uniqueCourseSlug(base: string, existing: string[]): string {
  const taken = new Set(existing)
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export type CourseLessonProgress = {
  id: number
  duration: string | null
  published: boolean
  status: string
}

export function isEligibleCourseLesson(lesson: { published: boolean; status: string }): boolean {
  return lesson.published && lesson.status === "ready"
}

/** Sem duração conhecida a aula não conta como concluída. */
export function isLessonComplete(seconds: number, duration: string | null | undefined): boolean {
  if (!Number.isFinite(seconds) || seconds <= 0) return false
  const total = durationToSeconds(duration)
  if (total <= 0) return false
  return seconds >= total * CONTINUE_DONE_RATIO
}

export function courseProgressPercent(completed: number, total: number): number | null {
  if (total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
}

export function summarizeCourseProgress(
  lessons: CourseLessonProgress[],
  secondsByVideo: Map<number, number>,
): { completed: number; total: number; percent: number | null } {
  const eligible = lessons.filter(isEligibleCourseLesson)
  const completed = eligible.filter((lesson) =>
    isLessonComplete(secondsByVideo.get(lesson.id) ?? 0, lesson.duration),
  ).length
  return {
    completed,
    total: eligible.length,
    percent: courseProgressPercent(completed, eligible.length),
  }
}

export type LessonWatchState = { seconds: number; updatedAt: number }

/** Última aula incompleta com progresso recente; senão a primeira incompleta da trilha. */
export function pickContinueLesson<T extends CourseLessonProgress>(
  lessons: T[],
  progressById: Map<number, LessonWatchState>,
): T | null {
  const eligible = lessons.filter(isEligibleCourseLesson)
  if (eligible.length === 0) return null
  const incomplete = eligible.filter(
    (lesson) => !isLessonComplete(progressById.get(lesson.id)?.seconds ?? 0, lesson.duration),
  )
  if (incomplete.length === 0) return eligible[0] ?? null

  let latest: T | null = null
  let latestAt = -1
  for (const lesson of incomplete) {
    const progress = progressById.get(lesson.id)
    if (!progress || progress.seconds < CONTINUE_MIN_SECONDS) continue
    if (progress.updatedAt > latestAt) {
      latest = lesson
      latestAt = progress.updatedAt
    }
  }
  return latest ?? incomplete[0] ?? null
}

export function courseCover(
  thumbnail: string | null | undefined,
  firstLessonThumb?: string | null,
): string {
  const usable = [thumbnail, firstLessonThumb].find((src) => src && src !== "/video-placeholder.svg")
  return usable || "/video-placeholder.svg"
}

/** Evita setState no player quando o segundo inteiro não mudou. */
export function mergeLessonSeconds(
  prev: Record<number, number>,
  id: number,
  seconds: number,
): Record<number, number> {
  const next = Math.floor(seconds)
  if ((prev[id] ?? 0) === next) return prev
  return { ...prev, [id]: next }
}

/** Uma linha da textarea vira um bullet na landing. */
export function parseLearnings(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => line.slice(0, 200))
}

export const COURSE_PLAN_LABEL: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
}

/** Duração amigável pra chips da landing — sem puxar ffmpeg no client. */
export function formatCourseDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ""
  if (seconds < 60) return "< 1 min"
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours}h ${rest}min`
  if (hours > 0) return `${hours}h`
  return `${minutes} min`
}

export function sumLessonDurations(lessons: { duration: string | null }[]): number {
  return lessons.reduce((total, lesson) => total + durationToSeconds(lesson.duration), 0)
}

export function courseLandingChips(input: {
  lessonCount: number
  moduleCount: number
  totalSeconds: number
}): string[] {
  const chips: string[] = []
  if (input.lessonCount > 0) {
    chips.push(`${input.lessonCount} ${input.lessonCount === 1 ? "aula" : "aulas"}`)
  }
  if (input.moduleCount > 0) {
    chips.push(`${input.moduleCount} ${input.moduleCount === 1 ? "módulo" : "módulos"}`)
  }
  const duration = formatCourseDuration(input.totalSeconds)
  if (duration) chips.push(duration)
  return chips
}

export function moduleCurriculumMeta(lessons: { duration: string | null }[]): string {
  const count = lessons.length
  const aulas = `${count} ${count === 1 ? "aula" : "aulas"}`
  const duration = formatCourseDuration(sumLessonDurations(lessons))
  return duration ? `${aulas} · ${duration}` : aulas
}

export function lessonKindLabel(source: string | null | undefined): string {
  return isArticleSource(source) ? "Artigo" : "Vídeo"
}

export type CourseLandingPreviewField = "thumbnail" | "description" | "learnings"

export function courseLandingPreviewHints(course: {
  thumbnail: string
  description: string | null
  learnings?: string[]
}): { field: CourseLandingPreviewField; message: string }[] {
  const hints: { field: CourseLandingPreviewField; message: string }[] = []
  if (!hasCustomThumb(course.thumbnail)) {
    hints.push({ field: "thumbnail", message: "Envie uma capa no editor para esta seção aparecer." })
  }
  if (!course.description?.trim()) {
    hints.push({ field: "description", message: "Preencha a descrição no editor para esta seção aparecer." })
  }
  if (!course.learnings?.length) {
    hints.push({ field: "learnings", message: "Preencha o que o aluno vai aprender no editor para esta seção aparecer." })
  }
  return hints
}

export type CourseLandingCta = {
  kind: "upgrade" | "start" | "empty"
  label: string
}

export function courseLandingCta(input: {
  locked: boolean
  isLoggedIn: boolean
  requiredPlan: string
  hasProgress: boolean
  hasPlayableLesson: boolean
}): CourseLandingCta {
  if (input.locked) {
    return {
      kind: "upgrade",
      label: input.isLoggedIn
        ? `Assinar ${COURSE_PLAN_LABEL[input.requiredPlan] ?? input.requiredPlan}`
        : "Entrar pra assinar",
    }
  }
  if (!input.hasPlayableLesson) {
    return { kind: "empty", label: "Este curso ainda não tem aulas" }
  }
  return { kind: "start", label: input.hasProgress ? "Continuar" : "Iniciar curso" }
}

export function courseLandingLessonState(lesson: {
  locked: boolean
  status: string
  progressSeconds: number
  duration: string | null
}): "locked" | "done" | "playable" {
  if (lesson.locked || lesson.status === "processing" || lesson.status === "error") return "locked"
  if (isLessonComplete(lesson.progressSeconds, lesson.duration)) return "done"
  return "playable"
}
