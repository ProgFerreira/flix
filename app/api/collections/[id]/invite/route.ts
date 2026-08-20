import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { handlePrismaError } from "@/lib/api-error"

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "editor"]).default("viewer"),
})

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
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  if (target.id === userId) return NextResponse.json({ error: "Você já é membro" }, { status: 400 })

  const newMember = await prisma.collectionMember.upsert({
    where: { collectionId_userId: { collectionId: Number(id), userId: target.id } },
    create: { collectionId: Number(id), userId: target.id, role: parsed.data.role },
    update: { role: parsed.data.role },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  return NextResponse.json(newMember)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const targetId = searchParams.get("userId")
  if (!targetId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })

  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId: Number(id), userId } },
  })
  if (!member || (member.role === "viewer" && Number(targetId) !== userId))
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  try {
    await prisma.collectionMember.delete({
      where: { collectionId_userId: { collectionId: Number(id), userId: Number(targetId) } },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const handled = handlePrismaError(err)
    if (handled) return handled
    throw err
  }
}
