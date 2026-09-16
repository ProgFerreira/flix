import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { optionalUserId, syncSubscriptionStatus } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { courseCurriculumInclude, flattenCourseLessons } from "@/lib/course-query"
import { publicCourseSummary } from "@/lib/course-public"
import type { LessonWatchState } from "@/lib/course"

export async function GET(req: NextRequest) {
  const userId = await optionalUserId()
  const { searchParams } = new URL(req.url)
  const plan = searchParams.get("plan")
  const paging = parsePageParams(searchParams)

  let requester: { plan: string; role: string } | null = null
  if (userId) {
    await syncSubscriptionStatus(userId)
    requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
  }

  const where = {
    published: true,
    ...(plan && ["free", "premium", "pro"].includes(plan) ? { requiredPlan: plan as "free" | "premium" | "pro" } : {}),
  }

  const [total, courses] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: paging.skip,
      take: paging.take,
      include: courseCurriculumInclude,
    }),
  ])

  const lessons = courses.flatMap((course) => flattenCourseLessons(course.modules))
  const ids = lessons.map((lesson) => lesson.id)
  const secondsByVideo = new Map<number, number>()
  const watchStateByVideo = new Map<number, LessonWatchState>()
  if (userId && ids.length > 0) {
    const progress = await prisma.watchProgress.findMany({
      where: { userId, videoId: { in: ids } },
      select: { videoId: true, seconds: true, updatedAt: true },
    })
    for (const row of progress) {
      secondsByVideo.set(row.videoId, row.seconds)
      watchStateByVideo.set(row.videoId, { seconds: row.seconds, updatedAt: row.updatedAt.getTime() })
    }
  }

  return NextResponse.json(paginated(
    courses.map((course) => publicCourseSummary(course, requester, userId, secondsByVideo, watchStateByVideo)),
    total,
    paging.page,
    paging.pageSize,
  ))
}
