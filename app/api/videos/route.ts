import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/utils"
import { requireUserId, PLAN_LIMITS } from "@/lib/session"

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

  const where: Record<string, unknown> = { userId }

  if (categoryId) where.videoCategories = { some: { categoryId: Number(categoryId) } }
  if (status === "watched") where.watched = true
  if (status === "unwatched") where.watched = false
  if (status === "favorites") where.favorite = true

  const orderBy =
    order === "oldest" ? [{ createdAt: "asc" as const }]
    : order === "az" ? [{ title: "asc" as const }]
    : order === "favorites" ? [{ favorite: "desc" as const }, { createdAt: "desc" as const }]
    : order === "manual" ? [{ sortOrder: "asc" as const }]
    : [{ createdAt: "desc" as const }]

  const videos = await prisma.video.findMany({
    where,
    include: { videoCategories: { include: { category: true } } },
    orderBy,
  })

  return NextResponse.json(videos)
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verificar limite do plano
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  const limit = PLAN_LIMITS[user?.plan ?? "free"]
  const count = await prisma.video.count({ where: { userId } })
  if (count >= limit) {
    const planName = user?.plan === "free" ? "Free (máx. 20)" : user?.plan === "premium" ? "Premium (máx. 100)" : "Pro"
    return NextResponse.json({ error: `Limite do plano ${planName} atingido. Faça upgrade em /plano.` }, { status: 403 })
  }

  const { url, title, categoryIds, channelName, duration, notes } = parsed.data
  const videoId = extractYouTubeId(url)
  if (!videoId) return NextResponse.json({ error: "URL do YouTube inválida" }, { status: 400 })

  const thumbnail = getYouTubeThumbnail(videoId)

  const video = await prisma.video.create({
    data: {
      userId,
      url,
      videoId,
      title,
      thumbnail,
      channelName,
      duration,
      notes,
      videoCategories: categoryIds?.length
        ? { create: categoryIds.map((cid) => ({ categoryId: cid })) }
        : undefined,
    },
    include: { videoCategories: { include: { category: true } } },
  })

  return NextResponse.json(video)
}
