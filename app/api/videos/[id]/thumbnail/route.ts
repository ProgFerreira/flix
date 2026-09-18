import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { prisma } from "@/lib/prisma"
import { optionalUserId } from "@/lib/session"
import { resolveThumbPath, fileCacheTag } from "@/lib/video-storage"
import { thumbContentType } from "@/lib/lesson-image"

export const runtime = "nodejs"

function canServeThumb(source: string) {
  return source === "upload" || source === "article"
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await optionalUserId()
  const { id } = await params
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId < 1) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { userId: true, source: true, published: true, thumbPath: true },
  })
  if (!video || !canServeThumb(video.source) || !video.thumbPath) {
    return NextResponse.json({ error: "Miniatura não encontrada" }, { status: 404 })
  }

  const isOwner = userId !== null && video.userId === userId
  // Publicado = preview da vitrine (card do catálogo). O MP4 continua paywalled no stream.
  let allowed = isOwner || video.published
  if (!allowed && userId !== null) {
    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    allowed = requester?.role === "admin"
  }
  if (!allowed) {
    return NextResponse.json({ error: "Miniatura não encontrada" }, { status: 404 })
  }

  const absolutePath = resolveThumbPath(video.thumbPath)
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    return NextResponse.json({ error: "Miniatura não encontrada" }, { status: 404 })
  }

  const etag = fileCacheTag(stat)
  const cacheControl = video.published ? "public, max-age=86400" : "private, no-cache"
  if (_req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl },
    })
  }

  let buf: Buffer
  try {
    buf = fs.readFileSync(absolutePath)
  } catch {
    return NextResponse.json({ error: "Miniatura não encontrada" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": thumbContentType(video.thumbPath),
      "Content-Length": String(buf.length),
      ETag: etag,
      "Cache-Control": cacheControl,
    },
  })
}

