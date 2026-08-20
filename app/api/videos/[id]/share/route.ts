import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

const schema = z.object({
  email: z.string().email("Email inválido"),
  permission: z.enum(["view", "edit"]).default("view"),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const video = await prisma.video.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!video || video.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const shares = await prisma.videoShare.findMany({
    where: { videoId: Number(id) },
    include: { to: { select: { id: true, email: true, name: true } } },
  })
  return NextResponse.json(shares)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const video = await prisma.video.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!video || video.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  if (target.id === userId) return NextResponse.json({ error: "Não pode compartilhar consigo mesmo" }, { status: 400 })

  const share = await prisma.videoShare.upsert({
    where: { videoId_toUserId: { videoId: Number(id), toUserId: target.id } },
    create: { videoId: Number(id), fromUserId: userId, toUserId: target.id, permission: parsed.data.permission },
    update: { permission: parsed.data.permission },
    include: { to: { select: { id: true, email: true, name: true } } },
  })
  return NextResponse.json(share)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const toUserId = searchParams.get("userId")
  if (!toUserId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })

  const video = await prisma.video.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!video || video.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  await prisma.videoShare.deleteMany({ where: { videoId: Number(id), toUserId: Number(toUserId) } })
  return NextResponse.json({ ok: true })
}
