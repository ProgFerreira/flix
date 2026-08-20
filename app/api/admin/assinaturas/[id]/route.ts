import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, calcNextBilling } from "@/lib/session"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json() as { action: "renew" | "cancel" | "reactivate"; note?: string; method?: string }

  const sub = await prisma.subscription.findUnique({ where: { id: Number(id) }, include: { user: true } })
  if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 })

  if (body.action === "renew") {
    const nextBillingDate = calcNextBilling(sub.billing)
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "active", nextBillingDate, updatedAt: new Date() } }),
      prisma.planPayment.create({
        data: {
          userId: sub.userId, subscriptionId: sub.id,
          plan: sub.plan, billing: sub.billing, amount: sub.amount,
          method: body.method ?? "manual", note: body.note,
        },
      }),
    ])
  } else if (body.action === "cancel") {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() } }),
      prisma.user.update({ where: { id: sub.userId }, data: { plan: "free" } }),
    ])
  } else if (body.action === "reactivate") {
    const nextBillingDate = calcNextBilling(sub.billing)
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: "active", cancelledAt: null, nextBillingDate, updatedAt: new Date() } }),
      prisma.user.update({ where: { id: sub.userId }, data: { plan: sub.plan } }),
    ])
  }

  return NextResponse.json({ ok: true })
}
