import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, calcNextBilling } from "@/lib/session"
import { logAdminAction } from "@/lib/audit"
import { parsePositiveInt } from "@/lib/admin-users"
import { adminAssinaturaPatchSchema } from "@/validators/assinatura-admin"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const subId = parsePositiveInt(id)
  if (!subId) return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = adminAssinaturaPatchSchema.safeParse(json)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const { action, note } = parsed.data
  const method = parsed.data.method ?? "manual"

  const sub = await prisma.subscription.findUnique({ where: { id: subId }, include: { user: true } })
  if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })

  if (action === "renew") {
    const nextBillingDate = calcNextBilling(sub.billing)
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "active", nextBillingDate, updatedAt: new Date() } }),
      prisma.planPayment.create({
        data: {
          userId: sub.userId, subscriptionId: sub.id,
          plan: sub.plan, billing: sub.billing, amount: sub.amount,
          method, note, criadoPorId: adminId,
        },
      }),
    ])
  } else if (action === "cancel") {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } }),
      prisma.user.update({ where: { id: sub.userId }, data: { plan: "free" } }),
    ])
  } else if (action === "reactivate") {
    const nextBillingDate = calcNextBilling(sub.billing)
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "active", cancelledAt: null, nextBillingDate, updatedAt: new Date() } }),
      prisma.user.update({ where: { id: sub.userId }, data: { plan: sub.plan } }),
    ])
  }

  await logAdminAction({
    adminId,
    action: action === "renew" ? "subscription.renew" : action === "cancel" ? "subscription.cancel" : "subscription.reactivate",
    targetType: "subscription",
    targetId: sub.id,
    meta: { userId: sub.userId },
  })

  return NextResponse.json({ ok: true })
}
