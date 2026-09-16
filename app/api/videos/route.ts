import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/utils"
import { requireUserId } from "@/lib/session"
import { ownedCategoryIds } from "@/lib/categories"
import { claimVideoSlot, QuotaExceededError } from "@/lib/plan-quota"
import { parsePageParams, paginated, MANUAL_PAGE_SIZE } from "@/lib/pagination"
import { serializeVideo } from "@/lib/serialize-video"

const schema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "Título obrigatório"),
  categoryIds: z.array(z.number()).optional(),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("categoryId")
  const status = searchParams.get("status")
  const order = searchParams.get("order") ?? "newest"
  const q = (searchParams.get("q") ?? "").trim()
  const paging = order === "manual"
    ? parsePageParams(searchParams, MANUAL_PAGE_SIZE, MANUAL_PAGE_SIZE)
    : parsePageParams(searchParams)

  const where: Record<string, unknown> = { userId, source: "youtube" }

  if (categoryId) where.videoCategories = { some: { categoryId: Number(categoryId) } }
  if (status === "watched") where.watched = true
  if (status === "unwatched") where.watched = false
  if (status === "favorites") where.favorite = true
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { channelName: { contains: q } },
    ]
  }

  const orderBy =
    order === "oldest" ? [{ createdAt: "asc" as const }]
    : order === "az" ? [{ title: "asc" as const }]
    : order === "favorites" ? [{ favorite: "desc" as const }, { createdAt: "desc" as const }]
    : order === "manual" ? [{ sortOrder: "asc" as const }]
    : [{ createdAt: "desc" as const }]

  const [total, videos] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      include: { videoCategories: { include: { category: true } } },
      orderBy,
      skip: paging.skip,
      take: paging.take,
    }),
  ])

  return NextResponse.json(paginated(videos.map(serializeVideo), total, paging.page, paging.pageSize))
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const { url, title, channelName, duration, notes } = parsed.data
  const categoryIds = await ownedCategoryIds(userId, parsed.data.categoryIds)
  const videoId = extractYouTubeId(url)
  if (!videoId) return NextResponse.json({ error: "URL do YouTube inválida" }, { status: 400 })

  const thumbnail = getYouTubeThumbnail(videoId)

  try {
    const video = await claimVideoSlot(userId, (tx) => tx.video.create({
      data: {
        userId,
        url,
        videoId,
        title,
        thumbnail,
        channelName,
        duration,
        notes,
        videoCategories: categoryIds.length
          ? { create: categoryIds.map((cid) => ({ categoryId: cid })) }
          : undefined,
      },
      include: { videoCategories: { include: { category: true } } },
    }))
    return NextResponse.json(serializeVideo(video))
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    throw err
  }
}
