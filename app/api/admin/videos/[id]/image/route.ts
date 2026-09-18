import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePositiveInt } from "@/lib/admin-users"
import { logAdminAction } from "@/lib/audit"
import { serializeVideo } from "@/lib/serialize-video"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { ensureThumbsDir, resolveThumbPath } from "@/lib/video-storage"
import {
  MAX_LESSON_IMAGE_BYTES,
  PLACEHOLDER_THUMB,
  detectImageMime,
  generateImageThumbFilename,
  unlinkLessonThumb,
} from "@/lib/lesson-image"

export const runtime = "nodejs"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function loadArticleLesson(rawId: string) {
  const id = parsePositiveInt(rawId)
  if (!id) return null
  const video = await prisma.video.findUnique({
    where: { id },
    select: { id: true, source: true, thumbPath: true },
  })
  if (!video || video.source !== "article") return null
  return video
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`lesson-image:${auth.userId}:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    return jsonError("Muitos envios. Tente de novo mais tarde.", 429)
  }

  const video = await loadArticleLesson((await params).id)
  if (!video) return jsonError("Aula não encontrada", 404)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonError("Envie a imagem como multipart/form-data.", 400)
  }
  const file = form.get("file")
  if (!(file instanceof File) || file.size <= 0) {
    return jsonError("Envie uma imagem JPEG, PNG ou WebP.", 400)
  }
  if (file.size > MAX_LESSON_IMAGE_BYTES) {
    return jsonError("A imagem deve ter até 5 MB.", 400)
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const mime = detectImageMime(new Uint8Array(buf.subarray(0, 16)))
  if (!mime) {
    return jsonError("Envie uma imagem JPEG, PNG ou WebP.", 400)
  }

  ensureThumbsDir()
  const filename = generateImageThumbFilename(mime)
  fs.writeFileSync(resolveThumbPath(filename), buf)

  try {
    const updated = await prisma.video.update({
      where: { id: video.id },
      data: {
        thumbPath: filename,
        thumbnail: `/api/videos/${video.id}/thumbnail`,
      },
    })
    await unlinkLessonThumb(video.thumbPath)
    await logAdminAction({
      adminId: auth.userId,
      action: "video.update",
      targetType: "video",
      targetId: video.id,
      meta: { image: true, mime, size: buf.length },
    })
    return NextResponse.json(serializeVideo(updated))
  } catch (err) {
    await unlinkLessonThumb(filename)
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const video = await loadArticleLesson((await params).id)
  if (!video) return jsonError("Aula não encontrada", 404)

  const updated = await prisma.video.update({
    where: { id: video.id },
    data: { thumbPath: null, thumbnail: PLACEHOLDER_THUMB },
  })
  await unlinkLessonThumb(video.thumbPath)
  await logAdminAction({
    adminId: auth.userId,
    action: "video.update",
    targetType: "video",
    targetId: video.id,
    meta: { image: false },
  })
  return NextResponse.json(serializeVideo(updated))
}
