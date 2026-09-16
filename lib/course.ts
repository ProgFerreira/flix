import { CONTINUE_DONE_RATIO, CONTINUE_MIN_SECONDS, durationToSeconds } from "@/lib/watch-continue"

export const COURSE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
