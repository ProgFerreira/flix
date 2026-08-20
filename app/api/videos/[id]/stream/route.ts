import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { Readable } from "stream"
import { prisma } from "@/lib/prisma"
import { requireUserId, syncSubscriptionStatus, canAccessCatalogVideo } from "@/lib/session"
import { resolveStoredFilePath, parseRangeHeader } from "@/lib/video-storage"

export const runtime = "nodejs"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const video = await prisma.video.findUnique({
    where: { id: Number(id) },
    select: { userId: true, source: true, filePath: true, mimeType: true, status: true, published: true, requiredPlan: true },
  })
  if (!video || video.source !== "upload" || !video.filePath) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }
  if (video.status !== "ready") {
    return NextResponse.json({ error: "Vídeo ainda em processamento" }, { status: 409 })
  }

  const isOwner = video.userId === userId
  let allowed = isOwner
  if (!allowed) {
    await syncSubscriptionStatus(userId)
    const requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
    allowed = !!requester && canAccessCatalogVideo({
      isOwner: false,
      isAdmin: requester.role === "admin",
      published: video.published,
      requiredPlan: video.requiredPlan,
      requesterPlan: requester.plan,
    })
  }
  if (!allowed) {
    return NextResponse.json({ error: "Sua assinatura não dá acesso a este vídeo" }, { status: 403 })
  }

  const absolutePath = resolveStoredFilePath(video.filePath)
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 })
  }

  const mimeType = video.mimeType ?? "video/mp4"
  const range = parseRangeHeader(req.headers.get("range"), stat.size)

  if (range) {
    const nodeStream = fs.createReadStream(absolutePath, { start: range.start, end: range.end })
    return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(range.end - range.start + 1),
        "Content-Type": mimeType,
        "Cache-Control": "private, no-store",
      },
    })
  }

  const nodeStream = fs.createReadStream(absolutePath)
  return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(stat.size),
      "Content-Type": mimeType,
      "Cache-Control": "private, no-store",
    },
  })
}
