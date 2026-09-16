import { prisma } from "@/lib/prisma"
import { PLAN_PRICES, calcNextBilling } from "@/lib/session"

export function parsePositiveInt(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export async function countOtherActiveAdmins(exceptId: number) {
  return prisma.user.count({
    where: { role: "admin", status: "active", deletadoEm: null, id: { not: exceptId } },
  })
}

/** Libera ou cancela o plano sem registrar pagamento (ajuste manual do admin). */
export async function applyPlanChange(userId: number, plan: "free" | "premium" | "pro") {
  if (plan === "free") {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { plan: "free" } }),
      prisma.subscription.updateMany({
        where: { userId, status: { not: "cancelled" } },
        data: { status: "cancelled", cancelledAt: new Date() },
      }),
    ])
    return
  }

  const billing = "monthly"
  const amount = PLAN_PRICES[plan]?.[billing] ?? 0
  const existing = await prisma.subscription.findUnique({ where: { userId } })
  const keepDate = existing && existing.status === "active" ? existing.nextBillingDate : calcNextBilling(billing)

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { plan } }),
    existing
      ? prisma.subscription.update({
          where: { userId },
          data: {
            plan,
            billing: existing.status === "active" ? existing.billing : billing,
            amount: existing.status === "active" ? existing.amount : amount,
            status: "active",
            nextBillingDate: keepDate,
            cancelledAt: null,
          },
        })
      : prisma.subscription.create({
          data: { userId, plan, billing, amount, nextBillingDate: keepDate, status: "active" },
        }),
  ])
}
