import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { removeVideoFiles } from "@/lib/video-storage"
import { ownedCategoryIds } from "@/lib/categories"
import { GrantLimitError, replaceVideoGrants, viewerIdsSchema } from "@/lib/video-grants"
import { serializeVideo } from "@/lib/serialize-video"
import { logAdminAction } from "@/lib/audit"

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  channelName: z.string().optional(),
  notes: z.string().optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).optional(),
  published: z.boolean().optional(),
  categoryIds: z.array(z.number()).optional(),
  viewerIds: viewerIdsSchema.optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const existing = await prisma.video.findUnique({
    where: { id: Number(id) },
    select: { source: true, userId: true },
  })
  if (!existing || (existing.source !== "upload" && existing.source !== "article")) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { categoryIds: rawCategoryIds, viewerIds, ...fields } = parsed.data
  const categoryIds = rawCategoryIds !== undefined
    ? await ownedCategoryIds(auth.userId, rawCategoryIds)
    : undefined
  const videoId = Number(id)

  try {
    const video = await prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.videoCategory.deleteMany({ where: { videoId } })
        if (categoryIds.length > 0) {
          await tx.videoCategory.createMany({ data: categoryIds.map((cid) => ({ videoId, categoryId: cid })) })
        }
      }
      if (viewerIds !== undefined) {
        await replaceVideoGrants(tx, {
          videoId,
          userIds: viewerIds,
          grantedBy: auth.userId,
          ownerId: existing.userId,
        })
      }
      return tx.video.update({
        where: { id: videoId },
        data: fields,
        include: { videoCategories: { include: { category: true } } },
      })
    })

    await logAdminAction({
      adminId: auth.userId,
      action: "video.update",
      targetType: "video",
      targetId: videoId,
    })
    return NextResponse.json(serializeVideo(video))
  } catch (err) {
    if (err instanceof GrantLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const existing = await prisma.video.findUnique({
    where: { id: Number(id) },
    select: { source: true, filePath: true, previewPath: true, playbackPath: true, thumbPath: true },
  })
  if (!existing || existing.source !== "upload") return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })

  await prisma.video.delete({ where: { id: Number(id) } })
  await removeVideoFiles(existing)
  await logAdminAction({
    adminId: auth.userId,
    action: "video.delete",
    targetType: "video",
    targetId: Number(id),
  })

  return NextResponse.json({ ok: true })
}
