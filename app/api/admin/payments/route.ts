import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, PLAN_PRICES, calcNextBilling } from "@/lib/session"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId, plan, billing = "monthly", method, note, amount: customAmount } = await req.json() as {
    userId: number; plan: string; billing?: string; method?: string; note?: string; amount?: number
  }

  if (!["premium", "pro", "free"].includes(plan)) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 })
  }

  const amount = customAmount ?? (plan !== "free" ? (PLAN_PRICES[plan]?.[billing] ?? 0) : 0)
  const nextBillingDate = calcNextBilling(billing)

  if (plan === "free") {
    // Rebaixar para free — cancela assinatura
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { plan: "free" } }),
      prisma.subscription.updateMany({ where: { userId }, data: { status: "cancelled", cancelledAt: new Date() } }),
    ])
    return NextResponse.json({ ok: true })
  }

  // Cria ou atualiza assinatura
  const existing = await prisma.subscription.findUnique({ where: { userId } })

  let subscriptionId: number

  if (existing) {
    const updated = await prisma.subscription.update({
      where: { userId },
      data: { plan, billing, amount, status: "active", nextBillingDate, cancelledAt: null, updatedAt: new Date() },
    })
    subscriptionId = updated.id
  } else {
    const created = await prisma.subscription.create({
      data: { userId, plan, billing, amount, nextBillingDate, status: "active" },
    })
    subscriptionId = created.id
  }

  // Registra o pagamento
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { plan } }),
    prisma.planPayment.create({
      data: { userId, subscriptionId, plan, billing, amount, method: method ?? "manual", note },
    }),
  ])

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const payments = await prisma.planPayment.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
    take: 200,
  })

  return NextResponse.json(payments)
}
