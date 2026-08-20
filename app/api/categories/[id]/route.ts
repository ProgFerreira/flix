import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { handlePrismaError } from "@/lib/api-error"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const cat = await prisma.category.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!cat || cat.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  await prisma.category.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth
  const { id } = await params
  const cat = await prisma.category.findUnique({ where: { id: Number(id) }, select: { userId: true } })
  if (!cat || cat.userId !== userId) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const category = await prisma.category.update({ where: { id: Number(id) }, data: parsed.data })
    return NextResponse.json(category)
  } catch (err) {
    const handled = handlePrismaError(err, { duplicate: "Você já tem uma categoria com esse nome" })
    if (handled) return handled
    throw err
  }
}
