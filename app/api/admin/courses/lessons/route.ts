import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { logAdminAction } from "@/lib/audit"
import { parseYouTubeVideoId } from "@/lib/youtube-url"
import { getYouTubeThumbnail } from "@/lib/utils"
import { claimVideoSlot, QuotaExceededError } from "@/lib/plan-quota"
import { validateUpload, generateStoredFilename, detectVideoMime, PLACEHOLDER_THUMB } from "@/lib/video-storage"
import { streamMultipartVideo, moveUploadToStorage, removeStoredFile, UploadError } from "@/lib/upload-stream"
import { enqueueVideoProcessing } from "@/lib/video-process"
import { serializeVideo } from "@/lib/serialize-video"
import { ARTICLE_LESSON_DURATION } from "@/lib/course"
import { courseLessonJsonSchema, courseLessonUploadSchema } from "@/validators/course"

export const runtime = "nodejs"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    return createUploadLesson(req, userId)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("JSON inválido", 400)
  }

  const parsed = courseLessonJsonSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Dados inválidos", 400)
  }

  try {
    if (parsed.data.kind === "youtube") {
      return await createYoutubeLesson(userId, parsed.data)
    }
    return await createArticleLesson(userId, parsed.data)
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return jsonError(err.message, 403)
    }
    throw err
  }
}

async function createYoutubeLesson(
  userId: number,
  data: { title: string; url: string; requiredPlan?: "free" | "premium" | "pro" },
) {
  const videoId = parseYouTubeVideoId(data.url)
  if (!videoId) return jsonError("Informe um link de vídeo do YouTube", 400)
  const requiredPlan = data.requiredPlan ?? "free"

  const video = await claimVideoSlot(userId, async (tx) => (
    tx.video.create({
      data: {
        userId,
        url: data.url,
        videoId,
        title: data.title,
        thumbnail: getYouTubeThumbnail(videoId),
        source: "youtube",
        status: "ready",
        published: false,
        requiredPlan,
      },
    })
  ))
  await logAdminAction({
    adminId: userId,
    action: "video.upload",
    targetType: "video",
    targetId: video.id,
    meta: { title: video.title, source: "youtube", courseLesson: true },
  })
  return NextResponse.json(serializeVideo(video))
}

async function createArticleLesson(
  userId: number,
  data: { title: string; body: string; requiredPlan?: "free" | "premium" | "pro" },
) {
  const requiredPlan = data.requiredPlan ?? "free"
  const video = await claimVideoSlot(userId, async (tx) => (
    tx.video.create({
      data: {
        userId,
        title: data.title,
        notes: data.body,
        thumbnail: PLACEHOLDER_THUMB,
        duration: ARTICLE_LESSON_DURATION,
        source: "article",
        status: "ready",
        published: false,
        requiredPlan,
      },
    })
  ))
  await logAdminAction({
    adminId: userId,
    action: "video.upload",
    targetType: "video",
    targetId: video.id,
    meta: { title: video.title, source: "article", courseLesson: true },
  })
  return NextResponse.json(serializeVideo(video))
}

async function createUploadLesson(req: NextRequest, userId: number) {
  let streamed
  try {
    streamed = await streamMultipartVideo(req)
  } catch (err) {
    if (err instanceof UploadError) {
      return jsonError(err.message, err.status)
    }
    throw err
  }

  const { fields, tempPath, size, header } = streamed
  const parsed = courseLessonUploadSchema.safeParse({
    title: fields.title,
    requiredPlan: fields.requiredPlan ?? "free",
  })
  if (!parsed.success) {
    await removeStoredFile(tempPath)
    return jsonError(parsed.error.issues[0]?.message ?? "Dados inválidos", 400)
  }

  const detectedMime = detectVideoMime(header)
  if (!detectedMime) {
    await removeStoredFile(tempPath)
    return jsonError("O arquivo não parece um vídeo MP4, WebM ou MOV. Confira o formato (não vale só a extensão).", 400)
  }
  const validation = validateUpload({ mimeType: detectedMime, size })
  if (!validation.ok) {
    await removeStoredFile(tempPath)
    return jsonError(validation.error, 400)
  }

  const filename = generateStoredFilename(detectedMime)
  const absolutePath = await moveUploadToStorage(tempPath, filename)
  const { title, requiredPlan } = parsed.data

  try {
    const video = await claimVideoSlot(userId, async (tx) => (
      tx.video.create({
        data: {
          userId,
          title,
          thumbnail: PLACEHOLDER_THUMB,
          source: "upload",
          filePath: filename,
          mimeType: detectedMime,
          fileSize: BigInt(size),
          status: "processing",
          published: false,
          requiredPlan,
        },
      })
    ))
    after(() => enqueueVideoProcessing(video.id))
    await logAdminAction({
      adminId: userId,
      action: "video.upload",
      targetType: "video",
      targetId: video.id,
      meta: { title: video.title, source: "upload", courseLesson: true },
    })
    return NextResponse.json(serializeVideo(video))
  } catch (err) {
    await removeStoredFile(absolutePath)
    if (err instanceof QuotaExceededError) {
      return jsonError(err.message, 403)
    }
    throw err
  }
}
