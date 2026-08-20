import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const current = await prisma.video.findUnique({ where: { id: Number(id) }, select: { favorite: true, userId: true } })
  if (!current || current.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const video = await prisma.video.update({
    where: { id: Number(id) },
    data: { favorite: !current.favorite },
    select: { id: true, favorite: true },
  })
  return NextResponse.json(video)
}
