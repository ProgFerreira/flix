import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const current = await prisma.video.findUnique({ where: { id: Number(id) }, select: { watched: true, userId: true } })
  if (!current || current.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const nowWatched = !current.watched
  const video = await prisma.video.update({
    where: { id: Number(id) },
    data: { watched: nowWatched, watchedAt: nowWatched ? new Date() : null },
    select: { id: true, watched: true, watchedAt: true },
  })
  return NextResponse.json(video)
}
