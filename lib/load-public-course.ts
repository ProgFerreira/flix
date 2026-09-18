import { prisma } from "@/lib/prisma"
import { courseSlugSchema } from "@/validators/course"
import { courseCurriculumInclude, flattenCourseLessons } from "@/lib/course-query"
import { publicCourseDetail, publicCourseSummary, serializeCourseReviews } from "@/lib/course-public"
import { grantedVideoIdsForUser } from "@/lib/video-grants"
import { optionalCatalogRequester } from "@/lib/catalog-requester"
import type { LessonWatchState } from "@/lib/course"

export async function loadPublicCourseBySlug(slug: string) {
  const slugParsed = courseSlugSchema.safeParse(slug)
  if (!slugParsed.success) return null

  const coursePromise = prisma.course.findUnique({
    where: { slug: slugParsed.data },
    include: courseCurriculumInclude,
  })
  const requesterRow = await optionalCatalogRequester()
  const course = await coursePromise
  if (!course) return null
  if (!course.published && requesterRow?.role !== "admin") return null

  const userId = requesterRow?.userId ?? null
  const requester = requesterRow
    ? { plan: requesterRow.plan, role: requesterRow.role }
    : null
  const lessons = flattenCourseLessons(course.modules)
  const ids = lessons.map((lesson) => lesson.id)

  const [progress, grants, favorite, reviews, relatedRows] = await Promise.all([
    userId && ids.length > 0
      ? prisma.watchProgress.findMany({
          where: { userId, videoId: { in: ids } },
          select: { videoId: true, seconds: true, updatedAt: true },
        })
      : Promise.resolve([]),
    userId && ids.length > 0 ? grantedVideoIdsForUser(userId, ids) : Promise.resolve(new Set<number>()),
    userId
      ? prisma.courseFavorite.findUnique({
          where: { userId_courseId: { userId, courseId: course.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.courseReview.findMany({
      where: { courseId: course.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.course.findMany({
      where: {
        published: true,
        id: { not: course.id },
        requiredPlan: course.requiredPlan,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 4,
      include: courseCurriculumInclude,
    }),
  ])

  const secondsByVideo = new Map<number, number>()
  const watchStateByVideo = new Map<number, LessonWatchState>()
  for (const row of progress) {
    secondsByVideo.set(row.videoId, row.seconds)
    watchStateByVideo.set(row.videoId, { seconds: row.seconds, updatedAt: row.updatedAt.getTime() })
  }

  const detail = publicCourseDetail(
    course,
    requester,
    userId,
    secondsByVideo,
    watchStateByVideo,
    grants,
  )

  return {
    ...detail,
    favorited: Boolean(favorite),
    reviews: serializeCourseReviews(reviews, userId),
    related: relatedRows.map((row) => publicCourseSummary(row, requester, userId, new Map(), new Map())),
  }
}
