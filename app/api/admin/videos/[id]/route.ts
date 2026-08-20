import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { resolveStoredFilePath } from "@/lib/video-storage"

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  channelName: z.string().optional(),
  notes: z.string().optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).optional(),
  published: z.boolean().optional(),
  categoryIds: z.array(z.number()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const existing = await prisma.video.findUnique({ where: { id: Number(id) }, select: { source: true } })
  if (!existing || existing.source !== "upload") return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { categoryIds, ...fields } = parsed.data

  const video = await prisma.$transaction(async (tx) => {
    if (categoryIds !== undefined) {
      await tx.videoCategory.deleteMany({ where: { videoId: Number(id) } })
      if (categoryIds.length > 0) {
        await tx.videoCategory.createMany({ data: categoryIds.map((cid) => ({ videoId: Number(id), categoryId: cid })) })
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const existing = await prisma.video.findUnique({ where: { id: Number(id) }, select: { source: true, filePath: true } })
  if (!existing || existing.source !== "upload") return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })

  await prisma.video.delete({ where: { id: Number(id) } })

  if (existing.filePath) {
    await fs.unlink(resolveStoredFilePath(existing.filePath)).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
