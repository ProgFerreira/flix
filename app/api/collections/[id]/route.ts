import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { newShareToken } from "@/lib/collection-share"

async function checkMember(collectionId: number, userId: number, minRole?: "editor" | "owner") {
  const member = await prisma.collectionMember.findUnique({
    where: { collectionId_userId: { collectionId, userId } },
  })
  if (!member) return null
  if (minRole === "owner" && member.role !== "owner") return null
  if (minRole === "editor" && member.role === "viewer") return null
  return member
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isPublic: z.boolean().optional(),
  rotateLink: z.literal(true).optional(),
}).refine((d) => d.name !== undefined || d.isPublic !== undefined || d.rotateLink === true, {
  message: "Nada para atualizar",
})

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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const collectionId = Number(id)
  const current = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { shareToken: true },
  })
  if (!current) return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 })

  const data: { name?: string; isPublic?: boolean; shareToken?: string } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic

  const needsToken = parsed.data.rotateLink === true || (parsed.data.isPublic === true && !current.shareToken)
  if (needsToken) data.shareToken = newShareToken()

  const collection = await prisma.collection.update({ where: { id: collectionId }, data })
  return NextResponse.json(collection)
}
