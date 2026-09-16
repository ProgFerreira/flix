import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, computeSubscriptionStatus } from "@/lib/session"
import { parsePositiveInt } from "@/lib/admin-users"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId } = await params
  const id = parsePositiveInt(userId)
  if (!id) return NextResponse.json({ error: "Usuário inválido" }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      status: true,
      createdAt: true,
      emailVerifiedAt: true,
      _count: { select: { videos: true, payments: true } },
      subscription: true,
    },
  })
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

  const payments = await prisma.planPayment.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
  })

  const { subscription, ...rest } = user
  return NextResponse.json({
    user: rest,
    subscription: subscription
      ? { ...subscription, status: computeSubscriptionStatus(new Date(), subscription) }
      : null,
    payments,
  })
}
