import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { optionalUserId, syncSubscriptionStatus } from "@/lib/session"
import { courseSlugSchema } from "@/validators/course"
import { courseCurriculumInclude, flattenCourseLessons } from "@/lib/course-query"
import { publicCourseDetail } from "@/lib/course-public"
import { grantedVideoIdsForUser } from "@/lib/video-grants"
import type { LessonWatchState } from "@/lib/course"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slugParsed = courseSlugSchema.safeParse((await params).slug)
  if (!slugParsed.success) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  const userId = await optionalUserId()
  let requester: { plan: string; role: string } | null = null
  if (userId) {
    await syncSubscriptionStatus(userId)
    requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
  }

  const course = await prisma.course.findUnique({
    where: { slug: slugParsed.data },
    include: courseCurriculumInclude,
  })
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  if (!course.published && requester?.role !== "admin") {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

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

  return NextResponse.json(publicCourseDetail(
    course,
    requester,
    userId,
    secondsByVideo,
    watchStateByVideo,
    grantIds,
  ))
}
