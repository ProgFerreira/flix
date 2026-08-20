import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

async function checkMember(collectionId: number, userId: number, minRole?: "editor" | "owner") {
  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId, userId } },
  })
  if (!member) return null
  if (minRole === "owner" && member.role !== "owner") return null
  if (minRole === "editor" && member.role === "viewer") return null
  return member
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const member = await checkMember(Number(id), userId, "owner")
  if (!member) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  await prisma.collection.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params

  const member = await checkMember(Number(id), userId, "owner")
  if (!member) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({ name: z.string().min(1) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const collection = await prisma.collection.update({ where: { id: Number(id) }, data: parsed.data })
  return NextResponse.json(collection)
}
