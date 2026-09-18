import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { removeVideoFiles } from "@/lib/video-storage"
import { ownedCategoryIds } from "@/lib/categories"
import { GrantLimitError, loadManagedCatalogVideo, replaceVideoGrants, viewerIdsSchema } from "@/lib/video-grants"
import { serializeVideo } from "@/lib/serialize-video"
import { logAdminAction } from "@/lib/audit"

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  channelName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).optional(),
  published: z.boolean().optional(),
  categoryIds: z.array(z.number().int().positive()).max(20).optional(),
  viewerIds: viewerIdsSchema.optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId < 1) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const loaded = await loadManagedCatalogVideo(userId, videoId)
  if ("error" in loaded) return loaded.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const { categoryIds: rawCategoryIds, viewerIds, ...fields } = parsed.data
  const categoryIds = rawCategoryIds !== undefined
    ? await ownedCategoryIds(loaded.video.userId, rawCategoryIds)
    : undefined

  try {
    const video = await prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.videoCategory.deleteMany({ where: { videoId } })
        if (categoryIds.length > 0) {
          await tx.videoCategory.createMany({
            data: categoryIds.map((cid) => ({ videoId, categoryId: cid })),
          })
        }
      }
      if (viewerIds !== undefined) {
        await replaceVideoGrants(tx, {
          videoId,
          userIds: viewerIds,
          grantedBy: userId,
          ownerId: loaded.video.userId,
        })
      }
      return tx.video.update({
        where: { id: videoId },
        data: {
          ...fields,
          channelName: fields.channelName === "" ? null : fields.channelName,
          notes: fields.notes === "" ? null : fields.notes,
        },
        include: { videoCategories: { include: { category: true } } },
      })
    })

    await logAdminAction({
      adminId: userId,
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
  const { userId } = auth
  const { id } = await params
  const videoId = Number(id)
  if (!Number.isInteger(videoId) || videoId < 1) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const loaded = await loadManagedCatalogVideo(userId, videoId)
  if ("error" in loaded) return loaded.error

  await prisma.video.delete({ where: { id: videoId } })
  if (loaded.video.source === "upload") {
    await removeVideoFiles(loaded.video)
  }
  await logAdminAction({
    adminId: userId,
    action: "video.delete",
    targetType: "video",
    targetId: videoId,
  })
  return NextResponse.json({ ok: true })
}
