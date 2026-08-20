import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/utils"
import { requireUserId } from "@/lib/session"

const schema = z.object({
  url: z.string().url(),
  categoryIds: z.array(z.number()).optional(),
})

async function fetchOembed(videoUrl: string): Promise<{ title: string; author_name: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { url, categoryIds } = parsed.data

  const playlistRes = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  })

  if (!playlistRes.ok) {
    return NextResponse.json({ error: "Não foi possível acessar a playlist" }, { status: 400 })
  }

  const html = await playlistRes.text()
  const matches = [...html.matchAll(/watch\?v=([a-zA-Z0-9_-]{11})/g)]
  const uniqueIds = [...new Set(matches.map((m) => m[1]))]

  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "Nenhum vídeo encontrado na playlist" }, { status: 400 })
  }

  const results: { id: number; title: string }[] = []

  for (const videoId of uniqueIds.slice(0, 50)) {
    const existing = await prisma.video.findFirst({ where: { videoId, userId } })
    if (existing) continue

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const meta = await fetchOembed(videoUrl)
    const title = meta?.title ?? videoId
    const channelName = meta?.author_name
    const thumbnail = getYouTubeThumbnail(videoId)

    const video = await prisma.video.create({
      data: {
        userId,
        url: videoUrl,
        videoId,
        title,
        thumbnail,
        channelName,
        videoCategories: categoryIds?.length
          ? { create: categoryIds.map((cid) => ({ categoryId: cid })) }
          : undefined,
      },
    })
    results.push({ id: video.id, title: video.title })
  }

  return NextResponse.json({ imported: results.length, videos: results })
}
