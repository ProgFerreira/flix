import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId: Number(id), userId } },
  })
  if (!member) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const videos = await prisma.collectionVideo.findMany({
    where: { collectionId: Number(id) },
    include: { video: { include: { videoCategories: { include: { category: true } }, user: { select: { id: true, email: true, name: true } } } } },
    orderBy: { addedAt: "desc" },
  })
  return NextResponse.json(videos.map(cv => cv.video))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId: Number(id), userId } },
  })
  if (!member || member.role === "viewer") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({ videoId: z.number() }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const cv = await prisma.collectionVideo.upsert({
    where: { collectionId_videoId: { collectionId: Number(id), videoId: parsed.data.videoId } },
    create: { collectionId: Number(id), videoId: parsed.data.videoId, addedBy: userId },
    update: {},
  })
  return NextResponse.json(cv)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "videoId obrigatório" }, { status: 400 })

  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId: Number(id), userId } },
  })
  if (!member || member.role === "viewer") return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  await prisma.collectionVideo.delete({
    where: { collectionId_videoId: { collectionId: Number(id), videoId: Number(videoId) } },
  })
  return NextResponse.json({ ok: true })
}
