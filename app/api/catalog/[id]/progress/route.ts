import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId, optionalUserId } from "@/lib/session"
import { resolveCatalogAccess } from "@/lib/catalog-access"

const patchSchema = z.object({
  seconds: z.number().int().min(0).max(60 * 60 * 12),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await optionalUserId()
  const videoId = Number((await params).id)
  if (!userId) return NextResponse.json({ seconds: 0 })

  const row = await prisma.watchProgress.findUnique({
    where: { userId_videoId: { userId, videoId } },
    select: { seconds: true },
  })
  return NextResponse.json({ seconds: row?.seconds ?? 0 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const videoId = Number((await params).id)
  if (!Number.isInteger(videoId) || videoId < 1) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const access = await resolveCatalogAccess(userId, videoId)
  if ("error" in access) return access.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "seconds inválido" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "seconds inválido" }, { status: 400 })

  const row = await prisma.watchProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    create: { userId, videoId, seconds: parsed.data.seconds },
    update: { seconds: parsed.data.seconds },
    select: { seconds: true },
  })
  return NextResponse.json(row)
}
