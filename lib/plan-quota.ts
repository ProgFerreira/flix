import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PLAN_LIMITS } from "@/lib/session"

export type PlanQuota = {
  allowed: boolean
  remaining: number
  plan: string
  error?: string
}

function planLabel(plan: string): string {
  if (plan === "free") return "Free (máx. 20)"
  if (plan === "premium") return "Premium (máx. 100)"
  return "Pro"
}

type Tx = Prisma.TransactionClient

async function lockUserAndCount(tx: Tx, userId: number) {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
  const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } })
  const plan = user?.plan ?? "free"
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const count = await tx.video.count({ where: { userId } })
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - count) : Infinity
  return { plan, limit, count, remaining }
}

export async function checkVideoQuota(userId: number, extra = 1): Promise<PlanQuota> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  const plan = user?.plan ?? "free"
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const count = await prisma.video.count({ where: { userId } })
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - count) : Infinity
  if (count + extra > limit) {
    return {
      allowed: false,
      remaining,
      plan,
      error: `Limite do plano ${planLabel(plan)} atingido. Faça upgrade em /plano.`,
    }
  }
  return { allowed: true, remaining, plan }
}

export class QuotaExceededError extends Error {
  constructor(public quota: PlanQuota) {
    super(quota.error ?? "Limite do plano atingido")
    this.name = "QuotaExceededError"
  }
}

/**
 * Reserva um slot da quota e cria o vídeo na mesma transação, com lock
 * FOR UPDATE na linha do usuário pra duas POSTs simultâneas não furarem o teto.
 */
export async function claimVideoSlot<T>(
  userId: number,
  create: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const { plan, limit, count, remaining } = await lockUserAndCount(tx, userId)
    if (count + 1 > limit) {
      throw new QuotaExceededError({
        allowed: false,
        remaining,
        plan,
        error: `Limite do plano ${planLabel(plan)} atingido. Faça upgrade em /plano.`,
      })
    }
    return create(tx)
  })
}
