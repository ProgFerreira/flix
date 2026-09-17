import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// A sessão é JWT (fica no navegador por até 24h) e `role`/`status` só são
// gravados nela no momento do login. Sem essa checagem no banco, bloquear ou
// excluir alguém não corta o acesso na hora — a pessoa segue autenticando com
// os dados antigos até o token expirar. Cada chamada aqui é um SELECT pela
// chave primária, barato, e é o portão real de toda rota de API.
async function currentDbUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true, deletadoEm: true },
  })
  if (!user || user.deletadoEm) return null
  return user
}

export async function requireUserId(): Promise<{ userId: number } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = Number(session.user.id)
  const user = await currentDbUser(userId)
  if (!user || user.status === "blocked") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  return { userId }
}

/**
 * Versão sem bloqueio do requireUserId — pro catálogo público, onde visitante
 * sem conta pode ver e assistir o que é gratuito. Retorna null em vez de 401
 * quando não há sessão válida, em vez de recusar a requisição.
 */
export async function optionalUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const userId = Number(session.user.id)
  const user = await currentDbUser(userId)
  if (!user || user.status === "blocked") return null
  return userId
}

export async function requireAdmin(): Promise<{ userId: number } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  const userId = Number(session.user.id)
  const user = await currentDbUser(userId)
  if (!user || user.status === "blocked") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
  }
  return { userId }
}

export { PLAN_LIMITS } from "@/lib/plan-config"

// [plano][cobrança] = valor
export { PLAN_PRICES } from "@/lib/plan-config"

export function calcNextBilling(billing: string): Date {
  const d = new Date()
  if (billing === "annual") d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

// ── Hierarquia de planos (catálogo de vídeos autorais) ──────────────────
export const PLAN_ORDER: Record<string, number> = { free: 0, premium: 1, pro: 2 }
export const PLAN_NAMES = ["free", "premium", "pro"] as const
export type UserPlanName = (typeof PLAN_NAMES)[number]

export function planRank(plan: string): number {
  return PLAN_ORDER[plan] ?? 0
}

/** true se `userPlan` dá acesso a conteúdo que exige `requiredPlan` */
export function hasPlanAccess(userPlan: string, requiredPlan: string): boolean {
  return planRank(userPlan) >= planRank(requiredPlan)
}

/** Planos cujo conteúdo a pessoa já pode assistir (Free vê só Free, Premium vê Free+Premium). */
export function plansCoveredBy(userPlan: string): UserPlanName[] {
  const rank = planRank(userPlan)
  return PLAN_NAMES.filter((plan) => planRank(plan) <= rank)
}

/**
 * Filtro da aba Todos: esconde o que o plano não cobre.
 * Chips Free/Premium/Pro e o deep link `?video=` ficam de fora — lá o card
 * aparece travado com o CTA de upgrade. Admin e Pro não restringem.
 */
export function catalogVisiblePlanFilter(opts: {
  requesterPlan: string
  isAdmin: boolean
  userId?: number | null
  includeGrants?: boolean
}): Record<string, unknown> | null {
  if (opts.isAdmin) return null
  const covered = plansCoveredBy(opts.requesterPlan)
  if (covered.length === PLAN_NAMES.length) return null
  const byPlan = { requiredPlan: { in: covered } }
  const withGrants = opts.includeGrants ?? Boolean(opts.userId)
  if (!withGrants || !opts.userId) return byPlan
  return {
    OR: [
      byPlan,
      { accessGrants: { some: { userId: opts.userId } } },
    ],
  }
}

export type CatalogVideoAccess = {
  isOwner: boolean
  isAdmin: boolean
  published: boolean
  requiredPlan: string
  requesterPlan: string
  /** Exceção: usuário na lista extra do vídeo (não abre rascunho). */
  isGranted?: boolean
}

/**
 * Decisão de acesso a um vídeo do catálogo autoral: dono e admin sempre
 * podem assistir (mesmo despublicado, pra pré-visualizar); qualquer outra
 * pessoa só se o vídeo estiver publicado e o plano dela cobrir o requisito
 * — ou se estiver na lista extra (presente / cliente).
 */
export function canAccessCatalogVideo(v: CatalogVideoAccess): boolean {
  if (v.isOwner || v.isAdmin) return true
  return v.published && (hasPlanAccess(v.requesterPlan, v.requiredPlan) || Boolean(v.isGranted))
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { userId },
      data: { status: nextStatus as "active" | "overdue" | "cancelled" | "expired" },
    })
    if (nextStatus === "expired") {
      await tx.user.update({ where: { id: userId }, data: { plan: "free" } })
    }
    return updated
  })
}
