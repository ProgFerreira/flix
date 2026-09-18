import { serializeVideo } from "@/lib/serialize-video"
import { canAccessCatalogVideo, hasPlanAccess } from "@/lib/session"
import {
  courseCover,
  courseKindCounts,
  formatCourseUpdatedAt,
  parseFaq,
  parseLearnings,
  pickContinueLesson,
  summarizeCourseProgress,
  sumLessonDurations,
  type LessonWatchState,
} from "@/lib/course"
import type { CourseLessonVideo } from "@/lib/course-query"

export type RequesterAccess = { plan: string; role: string } | null

export type CourseModuleRow = {
  id: number
  title: string
  sortOrder: number
  lessons: { sortOrder: number; video: CourseLessonVideo }[]
}

export type CourseRow = {
  id: number
  title: string
  slug: string
  description: string | null
  learnings?: string | null
  instructorName?: string | null
  level?: string | null
  requirements?: string | null
  audience?: string | null
  faq?: string | null
  trailerVideoId?: number | null
  thumbnail: string | null
  requiredPlan: string
  published: boolean
  sortOrder: number
  updatedAt?: Date
  modules: CourseModuleRow[]
}

function lessonAccess(
  video: CourseLessonVideo,
  requester: RequesterAccess,
  userId: number | null,
  grantIds: Set<number>,
) {
  return canAccessCatalogVideo({
    isOwner: userId != null && video.userId === userId,
    isAdmin: requester?.role === "admin",
    published: video.published,
    requiredPlan: video.requiredPlan,
    requesterPlan: requester?.plan ?? "free",
    isGranted: grantIds.has(video.id),
  })
}

export function isCourseCardLocked(requiredPlan: string, requester: RequesterAccess): boolean {
  if (requester?.role === "admin") return false
  return !hasPlanAccess(requester?.plan ?? "free", requiredPlan)
}

function firstChannelName(lessons: CourseLessonVideo[]): string | null {
  const name = lessons.find((lesson) => lesson.channelName?.trim())?.channelName?.trim()
  return name || null
}

export function publicCourseSummary(
  course: CourseRow,
  requester: RequesterAccess,
  userId: number | null,
  secondsByVideo: Map<number, number>,
  watchStateByVideo: Map<number, LessonWatchState>,
) {
  const lessons = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.video))
  const progress = summarizeCourseProgress(lessons, secondsByVideo)
  const continueLesson = userId ? pickContinueLesson(lessons, watchStateByVideo) : null
  const firstThumb = lessons.find((lesson) => lesson.thumbnail && lesson.thumbnail !== "/video-placeholder.svg")?.thumbnail
    ?? lessons.find((lesson) => lesson.thumbnail)?.thumbnail
    ?? null
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    thumbnail: courseCover(course.thumbnail, firstThumb),
    requiredPlan: course.requiredPlan,
    published: course.published,
    sortOrder: course.sortOrder,
    lessonCount: progress.total,
    completedCount: userId ? progress.completed : 0,
    progressPercent: userId ? progress.percent : null,
    locked: isCourseCardLocked(course.requiredPlan, requester),
    continueLesson: continueLesson
      ? { id: continueLesson.id, title: continueLesson.title }
      : null,
  }
}

export function publicCourseDetail(
  course: CourseRow,
  requester: RequesterAccess,
  userId: number | null,
  secondsByVideo: Map<number, number>,
  watchStateByVideo: Map<number, LessonWatchState>,
  grantIds: Set<number>,
) {
  const summary = publicCourseSummary(course, requester, userId, secondsByVideo, watchStateByVideo)
  const lessons = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.video))
  const kinds = courseKindCounts(lessons)
  return {
    ...summary,
    instructorName: course.instructorName?.trim() || firstChannelName(lessons),
    level: course.level ?? null,
    requirements: parseLearnings(course.requirements),
    audience: parseLearnings(course.audience),
    faq: parseFaq(course.faq),
    trailerVideoId: course.trailerVideoId ?? null,
    updatedAt: course.updatedAt ? course.updatedAt.toISOString() : null,
    updatedAtLabel: formatCourseUpdatedAt(course.updatedAt ?? null),
    videoCount: kinds.videoCount,
    articleCount: kinds.articleCount,
    totalSeconds: sumLessonDurations(lessons),
    learnings: parseLearnings(course.learnings),
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      lessons: module.lessons.map((lesson) => {
        const video = lesson.video
        const publicVideo = serializeVideo(video)
        const locked = !lessonAccess(video, requester, userId, grantIds)
        return {
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          duration: video.duration,
          channelName: video.channelName,
          source: video.source,
          videoId: video.videoId,
          requiredPlan: video.requiredPlan,
          published: video.published,
          status: video.status,
          qualities: publicVideo.qualities,
          progressSeconds: secondsByVideo.get(video.id) ?? 0,
          notes: locked ? null : (video.notes ?? null),
          locked,
        }
      }),
    })),
  }
}

export type CourseReviewRow = {
  id: number
  rating: number
  comment: string | null
  createdAt: Date
  userId: number
  user: { name: string | null }
}

export function serializeCourseReviews(rows: CourseReviewRow[], userId: number | null) {
  const count = rows.length
  const average = count === 0
    ? null
    : Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / count) * 10) / 10
  const mine = userId == null ? null : rows.find((row) => row.userId === userId) ?? null
  return {
    average,
    count,
    mine: mine ? { rating: mine.rating, comment: mine.comment } : null,
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: row.user.name?.trim() || "Aluno",
      createdAt: row.createdAt.toISOString(),
      mine: userId != null && row.userId === userId,
    })),
  }
}
