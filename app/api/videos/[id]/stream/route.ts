import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { Readable } from "stream"
import { prisma } from "@/lib/prisma"
import { optionalUserId, syncSubscriptionStatus, canAccessCatalogVideo } from "@/lib/session"
import { resolveStoredFilePath, parseRangeHeader, pickStreamAsset, fileCacheTag } from "@/lib/video-storage"
import { hasVideoGrant } from "@/lib/video-grants"

export const runtime = "nodejs"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await optionalUserId()
  const { id } = await params

  const video = await prisma.video.findUnique({
    where: { id: Number(id) },
    select: {
      userId: true, source: true, filePath: true, mimeType: true, status: true,
      published: true, requiredPlan: true, previewPath: true, playbackPath: true,
    },
  })
  if (!video || video.source !== "upload" || !video.filePath) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }
  if (video.status !== "ready") {
    return NextResponse.json({ error: "Vídeo ainda em processamento" }, { status: 409 })
  }

  const isOwner = userId !== null && video.userId === userId
  let allowed = isOwner
  if (!allowed) {
    // visitante sem conta (userId null) é tratado como "free": só destrava
    // o que é gratuito, sem consultar o banco por um usuário que não existe
    let requesterPlan = "free"
    let isAdmin = false
    let isGranted = false
    if (userId !== null) {
      await syncSubscriptionStatus(userId)
      const requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
      if (!requester) {
        return NextResponse.json({ error: "Sua assinatura não dá acesso a este vídeo" }, { status: 403 })
      }
      requesterPlan = requester.plan
      isAdmin = requester.role === "admin"
      isGranted = await hasVideoGrant(Number(id), userId)
    }
    allowed = canAccessCatalogVideo({
      isOwner: false,
      isAdmin,
      published: video.published,
      requiredPlan: video.requiredPlan,
      requesterPlan,
      isGranted,
    })
  }
  if (!allowed) {
    return NextResponse.json({ error: "Sua assinatura não dá acesso a este vídeo" }, { status: 403 })
  }

  const quality = new URL(req.url).searchParams.get("quality")
  const asset = pickStreamAsset({ ...video, filePath: video.filePath }, quality)
  const absolutePath = resolveStoredFilePath(asset.filename)
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 })
  }

  const mimeType = asset.mimeType
  const range = parseRangeHeader(req.headers.get("range"), stat.size)
  const etag = fileCacheTag(stat)
  // Paywalled: never public/CDN. private + no-cache deixa o browser
  // revalidar (If-None-Match → 304) sem guardar o arquivo depois do logout.
  const cacheHeaders = {
    ETag: etag,
    "Cache-Control": "private, no-cache",
    "Accept-Ranges": "bytes",
  }

  if (!range && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders })
  }

  if (range) {
    const nodeStream = fs.createReadStream(absolutePath, { start: range.start, end: range.end })
    return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...cacheHeaders,
        "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Type": mimeType,
      },
    })
  }

  const nodeStream = fs.createReadStream(absolutePath)
  return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      ...cacheHeaders,
      "Content-Length": String(stat.size),
      "Content-Type": mimeType,
    },
  })
}
