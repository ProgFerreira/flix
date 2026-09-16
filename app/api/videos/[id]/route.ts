import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { ownedCategoryIds } from "@/lib/categories"

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
  sortOrder: z.number().optional(),
})

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const video = await prisma.video.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!video || video.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  await prisma.video.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const existing = await prisma.video.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!existing) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const isOwner = existing.userId === userId
  const share = isOwner
    ? null
    : await prisma.videoShare.findUnique({
        where: { videoId_toUserId: { videoId: Number(id), toUserId: userId } },
        select: { permission: true },
      })
  if (!isOwner && share?.permission !== "edit") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const categoryOwnerId = isOwner ? userId : existing.userId
  const { categoryIds: rawCategoryIds, ...fields } = parsed.data
  const categoryIds = rawCategoryIds !== undefined
    ? await ownedCategoryIds(categoryOwnerId, rawCategoryIds)
    : undefined

  const video = await prisma.$transaction(async (tx) => {
    if (categoryIds !== undefined) {
      await tx.videoCategory.deleteMany({ where: { videoId: Number(id) } })
      if (categoryIds.length > 0) {
        await tx.videoCategory.createMany({
          data: categoryIds.map((cid) => ({ videoId: Number(id), categoryId: cid })),
        })
      }
    }
    return tx.video.update({
      where: { id: Number(id) },
      data: fields,
      include: { videoCategories: { include: { category: true } } },
    })
  })

  return NextResponse.json(video)
}
