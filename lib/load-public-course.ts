import { prisma } from "@/lib/prisma"
import { courseSlugSchema } from "@/validators/course"
import { courseCurriculumInclude, flattenCourseLessons } from "@/lib/course-query"
import { publicCourseDetail } from "@/lib/course-public"
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
  const secondsByVideo = new Map<number, number>()
  const watchStateByVideo = new Map<number, LessonWatchState>()
  let grantIds = new Set<number>()
  if (userId && ids.length > 0) {
    const [progress, grants] = await Promise.all([
      prisma.watchProgress.findMany({
        where: { userId, videoId: { in: ids } },
        select: { videoId: true, seconds: true, updatedAt: true },
      }),
      grantedVideoIdsForUser(userId, ids),
    ])
    for (const row of progress) {
      secondsByVideo.set(row.videoId, row.seconds)
      watchStateByVideo.set(row.videoId, { seconds: row.seconds, updatedAt: row.updatedAt.getTime() })
    }
    grantIds = grants
  }

  return publicCourseDetail(
    course,
    requester,
    userId,
    secondsByVideo,
    watchStateByVideo,
    grantIds,
  )
}
