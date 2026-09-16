import { Prisma, type BillingCycle, type PaymentMethod, type UserPlan } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PLAN_PRICES, calcNextBilling, planRank } from "@/lib/session"

export type PlanId = "free" | "premium" | "pro"
export type BillingId = "monthly" | "annual"

export class PlanChangeError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "PlanChangeError"
  }
}

export function isPaidPlan(plan: string): plan is "premium" | "pro" {
  return plan === "premium" || plan === "pro"
}

export function isPlanUpgrade(fromPlan: string, toPlan: string): boolean {
  return planRank(toPlan) > planRank(fromPlan)
}

/** Valor cobrado na solicitação — sempre no servidor, nunca do cliente. */
export function planChangeAmount(plan: string, billing: string): number {
  if (!isPaidPlan(plan)) return 0
  return PLAN_PRICES[plan]?.[billing] ?? 0
}

export function resolveBilling(plan: string, billing?: string): BillingId {
  if (!isPaidPlan(plan)) return "monthly"
  return billing === "annual" ? "annual" : "monthly"
}

type Tx = Prisma.TransactionClient

const requestSelect = {
  id: true,
  userId: true,
  fromPlan: true,
  toPlan: true,
  billing: true,
  amount: true,
  note: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  receiptPath: true,
  receiptMimeType: true,
  receiptSize: true,
} as const

export function serializePlanChange<T extends { amount: Prisma.Decimal | number | string; receiptPath?: string | null }>(row: T) {
  const { receiptPath, ...rest } = row
  return { ...rest, amount: row.amount.toString(), hasReceipt: Boolean(receiptPath) }
}

export async function getPendingPlanChange(userId: number) {
  return prisma.planChangeRequest.findFirst({
    where: { userId, status: "pending" },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
  })
}

export async function createPlanChangeRequest(opts: {
  userId: number
  toPlan: PlanId
  billing?: string
  note?: string
}) {
  const billing = resolveBilling(opts.toPlan, opts.billing)
  const amount = planChangeAmount(opts.toPlan, billing)

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM User WHERE id = ${opts.userId} FOR UPDATE`
      const user = await tx.user.findUnique({ where: { id: opts.userId }, select: { plan: true } })
      if (!user) throw new PlanChangeError("Usuário não encontrado", 404)
      if (user.plan === opts.toPlan) {
        throw new PlanChangeError("Você já está neste plano", 400)
      }

      const pending = await tx.planChangeRequest.findFirst({
        where: { userId: opts.userId, status: "pending" },
        select: { id: true },
      })
      if (pending) {
        throw new PlanChangeError("Já existe uma solicitação aguardando aprovação. Cancele-a para pedir outro plano.", 409)
      }

      return tx.planChangeRequest.create({
        data: {
          userId: opts.userId,
          fromPlan: user.plan,
          toPlan: opts.toPlan,
          billing,
          amount,
          note: opts.note || null,
        },
        select: requestSelect,
      })
    })
  } catch (err) {
    if (err instanceof PlanChangeError) throw err
    throw err
  }
}

export async function cancelPlanChangeRequest(userId: number) {
  const updated = await prisma.planChangeRequest.updateMany({
    where: { userId, status: "pending" },
    data: { status: "cancelled" },
  })
  if (updated.count === 0) {
    throw new PlanChangeError("Nenhuma solicitação pendente para cancelar", 404)
  }
}

async function activateFreePlan(tx: Tx, userId: number) {
  await tx.user.update({ where: { id: userId }, data: { plan: "free" } })
  await tx.subscription.updateMany({
    where: { userId, status: { not: "cancelled" } },
    data: { status: "cancelled", cancelledAt: new Date() },
  })
}

async function activatePaidPlan(
  tx: Tx,
  opts: { userId: number; plan: UserPlan; billing: BillingCycle; amount: number; resetCycle: boolean },
) {
  const existing = await tx.subscription.findUnique({ where: { userId: opts.userId } })
  const nextBillingDate = opts.resetCycle || !existing || existing.status !== "active"
    ? calcNextBilling(opts.billing)
    : existing.nextBillingDate

  const subscription = existing
    ? await tx.subscription.update({
        where: { userId: opts.userId },
        data: {
          plan: opts.plan,
          billing: opts.billing,
          amount: opts.amount,
          status: "active",
          nextBillingDate,
          cancelledAt: null,
        },
      })
    : await tx.subscription.create({
        data: {
          userId: opts.userId,
          plan: opts.plan,
          billing: opts.billing,
          amount: opts.amount,
          nextBillingDate,
          status: "active",
        },
      })

  await tx.user.update({ where: { id: opts.userId }, data: { plan: opts.plan } })
  return subscription
}

export async function reviewPlanChangeRequest(opts: {
  requestId: number
  adminId: number
  action: "approve" | "reject"
  method?: string
  note?: string
}) {
  const method: PaymentMethod =
    opts.method === "pix" || opts.method === "card" || opts.method === "boleto" || opts.method === "manual"
      ? opts.method
      : "pix"

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM PlanChangeRequest WHERE id = ${opts.requestId} FOR UPDATE`
    const request = await tx.planChangeRequest.findUnique({ where: { id: opts.requestId } })
    if (!request) throw new PlanChangeError("Solicitação não encontrada", 404)
    if (request.status !== "pending") {
      throw new PlanChangeError("Esta solicitação já foi analisada", 409)
    }

    if (opts.action === "reject") {
      return tx.planChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "rejected",
          reviewedBy: opts.adminId,
          reviewedAt: new Date(),
          reviewNote: opts.note || null,
        },
        select: requestSelect,
      })
    }

    if (request.toPlan === "free") {
      await activateFreePlan(tx, request.userId)
    } else {
      const upgrade = isPlanUpgrade(request.fromPlan, request.toPlan)
      const subscription = await activatePaidPlan(tx, {
        userId: request.userId,
        plan: request.toPlan,
        billing: request.billing,
        amount: Number(request.amount),
        resetCycle: upgrade,
      })
      if (upgrade) {
        await tx.planPayment.create({
          data: {
            userId: request.userId,
            subscriptionId: subscription.id,
            plan: request.toPlan,
            billing: request.billing,
            amount: request.amount,
            method,
            note: opts.note || request.note,
            criadoPorId: opts.adminId,
          },
        })
      }
    }

    return tx.planChangeRequest.update({
      where: { id: request.id },
      data: {
        status: "approved",
        reviewedBy: opts.adminId,
        reviewedAt: new Date(),
        reviewNote: opts.note || null,
      },
      select: requestSelect,
    })
  })
}
