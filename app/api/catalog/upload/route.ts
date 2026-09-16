import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/session"
import { validateUpload, generateStoredFilename, detectVideoMime, PLACEHOLDER_THUMB } from "@/lib/video-storage"
import { streamMultipartVideo, moveUploadToStorage, removeStoredFile, UploadError } from "@/lib/upload-stream"
import { ownedCategoryIds } from "@/lib/categories"
import { claimVideoSlot, QuotaExceededError } from "@/lib/plan-quota"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { GrantLimitError, parseViewerIdsField, replaceVideoGrants } from "@/lib/video-grants"
import { enqueueVideoProcessing } from "@/lib/video-process"
import { serializeVideo } from "@/lib/serialize-video"
import { logAdminAction } from "@/lib/audit"

export const runtime = "nodejs"

const PUBLISH_LIMIT = 20
const PUBLISH_WINDOW_MS = 60 * 60 * 1000

const metaSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  channelName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).default("free"),
  published: z.enum(["true", "false"]).default("true"),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`catalog-publish:${userId}:${ip}`, PUBLISH_LIMIT, PUBLISH_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas publicações em pouco tempo. Tente de novo mais tarde." },
      { status: 429 },
    )
  }

  let streamed
  try {
    streamed = await streamMultipartVideo(req)
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }

  const { fields, tempPath, size, header } = streamed

  const parsed = metaSchema.safeParse({
    title: fields.title,
    channelName: fields.channelName,
    notes: fields.notes,
    requiredPlan: fields.requiredPlan ?? "free",
    published: fields.published ?? "true",
  })
  if (!parsed.success) {
    await removeStoredFile(tempPath)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  let categoryIds: number[] = []
  if (fields.categoryIds) {
    try {
      const arr = JSON.parse(fields.categoryIds)
      if (Array.isArray(arr) && arr.every((v) => typeof v === "number")) categoryIds = arr
    } catch {
      await removeStoredFile(tempPath)
      return NextResponse.json({ error: "categoryIds inválido" }, { status: 400 })
    }
  }
  categoryIds = await ownedCategoryIds(userId, categoryIds)

  const viewers = parseViewerIdsField(fields.viewerIds)
  if (!viewers.ok) {
    await removeStoredFile(tempPath)
    return NextResponse.json({ error: viewers.error }, { status: 400 })
  }
  const viewerIds = viewers.ids ?? []

  const detectedMime = detectVideoMime(header)
  if (!detectedMime) {
    await removeStoredFile(tempPath)
    return NextResponse.json(
      { error: "O arquivo não parece um vídeo MP4, WebM ou MOV. Confira o formato (não vale só a extensão)." },
      { status: 400 },
    )
  }
  const validation = validateUpload({ mimeType: detectedMime, size })
  if (!validation.ok) {
    await removeStoredFile(tempPath)
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const filename = generateStoredFilename(detectedMime)
  const absolutePath = await moveUploadToStorage(tempPath, filename)
  const { title, requiredPlan, published } = parsed.data
  const channelName = parsed.data.channelName || undefined
  const notes = parsed.data.notes || undefined

  try {
    const video = await claimVideoSlot(userId, async (tx) => {
      const created = await tx.video.create({
        data: {
          userId,
          title,
          channelName,
          notes,
          thumbnail: PLACEHOLDER_THUMB,
          source: "upload",
          filePath: filename,
          mimeType: detectedMime,
          fileSize: BigInt(size),
          status: "processing",
          published: published === "true",
          requiredPlan,
          videoCategories: categoryIds.length ? { create: categoryIds.map((cid) => ({ categoryId: cid })) } : undefined,
        },
        include: { videoCategories: { include: { category: true } } },
      })
      if (viewerIds.length) {
        await replaceVideoGrants(tx, { videoId: created.id, userIds: viewerIds, grantedBy: userId, ownerId: userId })
      }
      return created
    })
    after(() => enqueueVideoProcessing(video.id))
    await logAdminAction({
      adminId: userId,
      action: "video.upload",
      targetType: "video",
      targetId: video.id,
      meta: { title: video.title, source: "upload" },
    })
    return NextResponse.json(serializeVideo(video))
  } catch (err) {
    await removeStoredFile(absolutePath)
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof GrantLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
