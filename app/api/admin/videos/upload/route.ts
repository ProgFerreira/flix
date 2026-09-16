import { after } from "next/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { validateUpload, generateStoredFilename, detectVideoMime, PLACEHOLDER_THUMB } from "@/lib/video-storage"
import { streamMultipartVideo, moveUploadToStorage, removeStoredFile, UploadError } from "@/lib/upload-stream"
import { ownedCategoryIds } from "@/lib/categories"
import { GrantLimitError, parseViewerIdsField, replaceVideoGrants } from "@/lib/video-grants"
import { enqueueVideoProcessing } from "@/lib/video-process"
import { logAdminAction } from "@/lib/audit"
import { serializeVideo } from "@/lib/serialize-video"

export const runtime = "nodejs"

const metaSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  notes: z.string().optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).default("free"),
  published: z.enum(["true", "false"]).default("false"),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

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
    published: fields.published ?? "false",
  })
  if (!parsed.success) {
    await removeStoredFile(tempPath)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
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
  const { title, channelName, notes, requiredPlan, published } = parsed.data

  try {
    const video = await prisma.$transaction(async (tx) => {
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
      meta: { title: video.title },
    })
    return NextResponse.json(serializeVideo(video))
  } catch (err) {
    await removeStoredFile(absolutePath)
    if (err instanceof GrantLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
