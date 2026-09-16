import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { parsePositiveInt } from "@/lib/admin-users"
import {
  GrantLimitError,
  listVideoGrants,
  loadManagedCatalogVideo,
  replaceVideoGrants,
  viewerIdsSchema,
} from "@/lib/video-grants"

const putSchema = z.object({
  viewerIds: viewerIdsSchema,
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const videoId = parsePositiveInt((await params).id)
  if (videoId == null) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const loaded = await loadManagedCatalogVideo(auth.userId, videoId)
  if ("error" in loaded) return loaded.error

  const viewers = await listVideoGrants(videoId)
  return NextResponse.json(viewers)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const videoId = parsePositiveInt((await params).id)
  if (videoId == null) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const loaded = await loadManagedCatalogVideo(auth.userId, videoId)
  if ("error" in loaded) return loaded.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  try {
    await prisma.$transaction((tx) => replaceVideoGrants(tx, {
      videoId,
      userIds: parsed.data.viewerIds,
      grantedBy: auth.userId,
      ownerId: loaded.video.userId,
    }))
  } catch (err) {
    if (err instanceof GrantLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const viewers = await listVideoGrants(videoId)
  return NextResponse.json(viewers)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const videoId = parsePositiveInt((await params).id)
  if (videoId == null) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const loaded = await loadManagedCatalogVideo(auth.userId, videoId)
  if ("error" in loaded) return loaded.error

  const targetId = parsePositiveInt(new URL(req.url).searchParams.get("userId") ?? "")
  if (targetId == null) {
    return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })
  }

  await prisma.videoAccessGrant.deleteMany({ where: { videoId, userId: targetId } })
  return NextResponse.json({ ok: true })
}
