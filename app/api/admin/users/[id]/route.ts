import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const targetId = Number(id)
  const body = await req.json()
  const { status, plan, role } = body as { status?: string; plan?: string; role?: string }

  const data: Record<string, string> = {}
  if (status) data.status = status
  if (plan) data.plan = plan
  if (role) data.role = role

  const user = await prisma.user.update({ where: { id: targetId }, data })
  return NextResponse.json({ ok: true, user: { id: user.id, status: user.status, plan: user.plan, role: user.role } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const targetId = Number(id)

  if (targetId === adminId) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta" }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: targetId } })
  return NextResponse.json({ ok: true })
}
