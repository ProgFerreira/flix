import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const courseIdRaw = Number(searchParams.get("courseId") ?? 0)
  const courseId = Number.isInteger(courseIdRaw) && courseIdRaw > 0 ? courseIdRaw : null

  const videos = await prisma.video.findMany({
    where: {
      AND: [
        { source: { in: ["youtube", "upload"] } },
        { OR: [{ published: true }, { source: "upload" }] },
        ...(q ? [{ title: { contains: q } }] : []),
        {
          OR: [
            { courseLesson: null },
            ...(courseId ? [{ courseLesson: { module: { courseId } } }] : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      thumbnail: true,
      duration: true,
      channelName: true,
      source: true,
      published: true,
      requiredPlan: true,
      status: true,
      courseLesson: { select: { module: { select: { courseId: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  })

  return NextResponse.json({
    items: videos.map(({ courseLesson, ...video }) => ({
      ...video,
      inThisCourse: courseLesson?.module.courseId === courseId,
    })),
  })
}
