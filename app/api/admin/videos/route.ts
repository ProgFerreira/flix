import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { serializeVideo } from "@/lib/serialize-video"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const paging = parsePageParams(new URL(req.url).searchParams)

  const where = { source: "upload" as const }
  const [total, videos] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      include: { videoCategories: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.take,
    }),
  ])

  return NextResponse.json(paginated(
    videos.map((v) => serializeVideo(v)),
    total,
    paging.page,
    paging.pageSize,
  ))
}
