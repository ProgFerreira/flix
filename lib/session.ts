import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function requireUserId(): Promise<{ userId: number } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return { userId: Number(session.user.id) }
}

export async function requireAdmin(): Promise<{ userId: number } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  return { userId: Number(session.user.id) }
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 20,
  premium: 100,
  pro: Infinity,
}

// [plano][cobrança] = valor
export const PLAN_PRICES: Record<string, Record<string, number>> = {
  premium: { monthly: 10.00, annual: 96.00 },
  pro:     { monthly: 17.90, annual: 171.84 },
}

export function calcNextBilling(billing: string): Date {
  const d = new Date()
  if (billing === "annual") d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

// ── Hierarquia de planos (catálogo de vídeos autorais) ──────────────────
export const PLAN_ORDER: Record<string, number> = { free: 0, premium: 1, pro: 2 }

export function planRank(plan: string): number {
  return PLAN_ORDER[plan] ?? 0
}

/** true se `userPlan` dá acesso a conteúdo que exige `requiredPlan` */
export function hasPlanAccess(userPlan: string, requiredPlan: string): boolean {
  return planRank(userPlan) >= planRank(requiredPlan)
}

export type CatalogVideoAccess = {
  isOwner: boolean
  isAdmin: boolean
  published: boolean
  requiredPlan: string
  requesterPlan: string
}

/**
 * Decisão de acesso a um vídeo do catálogo autoral: dono e admin sempre
 * podem assistir (mesmo despublicado, pra pré-visualizar); qualquer outra
 * pessoa só se o vídeo estiver publicado e o plano dela cobrir o requisito.
 */
export function canAccessCatalogVideo(v: CatalogVideoAccess): boolean {
  if (v.isOwner || v.isAdmin) return true
  return v.published && hasPlanAccess(v.requesterPlan, v.requiredPlan)
}

// ── Expiração de assinatura (cobrança é manual, sem gateway) ────────────
// Dias de tolerância após o vencimento antes de considerar a assinatura expirada de vez.
export const SUBSCRIPTION_GRACE_DAYS = 5

export type SubscriptionLike = { status: string; nextBillingDate: Date }

/**
 * Função pura: dado o estado atual da assinatura e o instante presente,
 * decide o status correto. "cancelled" é uma decisão manual do admin e nunca
 * é sobrescrito aqui.
 */
export function computeSubscriptionStatus(now: Date, sub: SubscriptionLike): string {
  if (sub.status === "cancelled") return "cancelled"
  if (now <= sub.nextBillingDate) return "active"

  const graceEnd = new Date(sub.nextBillingDate)
  graceEnd.setDate(graceEnd.getDate() + SUBSCRIPTION_GRACE_DAYS)
  return now <= graceEnd ? "overdue" : "expired"
}

/**
 * Plano efetivo de um usuário levando em conta o vencimento da assinatura.
 * Assinatura "expired" derruba o acesso pra "free" mesmo que `user.plan`
 * no banco ainda não tenha sido rebaixado.
 */
export function effectivePlan(userPlan: string, subscription: SubscriptionLike | null, now = new Date()): string {
  if (!subscription) return userPlan
  return computeSubscriptionStatus(now, subscription) === "expired" ? "free" : userPlan
}

/**
 * Sincroniza no banco o status da assinatura (e rebaixa User.plan pra "free"
 * quando expira). Sem gateway de pagamento, isso é o que mantém o paywall
 * honesto — chamar antes de checar acesso a conteúdo do catálogo.
 */
export async function syncSubscriptionStatus(userId: number) {
  const { prisma } = await import("@/lib/prisma")
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) return null

  const now = new Date()
  const nextStatus = computeSubscriptionStatus(now, sub)
  if (nextStatus === sub.status) return sub

  const updated = await prisma.subscription.update({
    where: { userId },
    data: { status: nextStatus },
  })
  if (nextStatus === "expired") {
    await prisma.user.update({ where: { id: userId }, data: { plan: "free" } })
  }
  return updated
}
