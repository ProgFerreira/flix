import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

const categorySchema = z.object({ name: z.string(), color: z.string().default("#e85d04") })
const videoSchema = z.object({
  url: z.string(), videoId: z.string(), title: z.string(), thumbnail: z.string(),
  duration: z.string().nullish(), channelName: z.string().nullish(),
  watched: z.boolean().default(false), favorite: z.boolean().default(false),
  notes: z.string().nullish(),
  categories: z.array(z.object({ name: z.string() })).optional(),
})
const importSchema = z.object({
  categories: z.array(categorySchema).optional(),
  videos: z.array(videoSchema),
})

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { categories = [], videos } = parsed.data
  const catMap = new Map<string, number>()

  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { userId, name: cat.name } })
    if (existing) {
      catMap.set(cat.name, existing.id)
    } else {
      const created = await prisma.category.create({ data: { name: cat.name, color: cat.color, userId } })
      catMap.set(cat.name, created.id)
    }
  }

  let imported = 0, skipped = 0
  for (const v of videos) {
    const existing = await prisma.video.findFirst({ where: { userId, videoId: v.videoId } })
    if (existing) { skipped++; continue }

    const categoryIds = (v.categories ?? []).map((c) => catMap.get(c.name)).filter((id): id is number => id !== undefined)

    await prisma.video.create({
      data: {
        userId, url: v.url, videoId: v.videoId, title: v.title, thumbnail: v.thumbnail,
        duration: v.duration ?? undefined, channelName: v.channelName ?? undefined,
        watched: v.watched, favorite: v.favorite, notes: v.notes ?? undefined,
        videoCategories: categoryIds.length ? { create: categoryIds.map((cid) => ({ categoryId: cid })) } : undefined,
      },
    })
    imported++
  }

  return NextResponse.json({ imported, skipped })
}
