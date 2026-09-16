import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { resolveCatalogAccess } from "@/lib/catalog-access"

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const videoId = Number((await params).id)
  if (!Number.isInteger(videoId) || videoId < 1) {
    return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 })
  }

  const access = await resolveCatalogAccess(userId, videoId)
  if ("error" in access) return access.error

  const existing = await prisma.favorite.findUnique({
    where: { userId_videoId: { userId, videoId } },
  })
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false })
  }
  await prisma.favorite.create({ data: { userId, videoId } })
  return NextResponse.json({ favorited: true })
}
