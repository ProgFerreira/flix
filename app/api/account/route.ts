import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId, syncSubscriptionStatus, computeSubscriptionStatus } from "@/lib/session"
import { getPendingPlanChange, serializePlanChange } from "@/lib/plan-change"
import { accountPatchSchema } from "@/validators/account"
import { deleteUserAccount } from "@/lib/delete-user"

function serializeMoney<T extends { amount: Prisma.Decimal | number | string }>(row: T) {
  return { ...row, amount: row.amount.toString() }
}

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  await syncSubscriptionStatus(userId)

  const [user, pending] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
        _count: { select: { videos: true } },
        subscription: {
          select: {
            plan: true,
            billing: true,
            amount: true,
            status: true,
            startDate: true,
            nextBillingDate: true,
            cancelledAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            plan: true,
            billing: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
      },
    }),
    getPendingPlanChange(userId),
  ])
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { payments, subscription, _count, ...profile } = user
  return NextResponse.json({
    ...profile,
    videoCount: _count.videos,
    subscription: subscription
      ? serializeMoney({
          ...subscription,
          status: computeSubscriptionStatus(new Date(), subscription),
        })
      : null,
    pendingRequest: pending ? serializePlanChange(pending) : null,
    payments: payments.map(serializeMoney),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = accountPatchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const data: { name?: string; password?: string } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name

  if (parsed.data.newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    const valid = await bcrypt.compare(parsed.data.currentPassword ?? "", user.password)
    if (!valid) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 })
    data.password = await bcrypt.hash(parsed.data.newPassword, 10)
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, plan: true, role: true },
  })
  return NextResponse.json(user)
}

export async function DELETE() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  await deleteUserAccount(auth.userId)
  return NextResponse.json({ ok: true })
}
