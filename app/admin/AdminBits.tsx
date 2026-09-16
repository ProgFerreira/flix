"use client"

import { formatMoney } from "@/lib/money"

export const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

export const METHOD_LABEL: Record<string, string> = {
  pix: "PIX", card: "Cartão", boleto: "Boleto", manual: "Manual",
}

export const BILLING_LABEL: Record<string, string> = { monthly: "Mensal", annual: "Anual" }

export const SUB_STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  overdue: "Vencida",
  cancelled: "Cancelada",
  expired: "Expirada",
}

export function PlanBadge({ plan }: { plan: string }) {
  const key = plan === "premium" || plan === "pro" ? plan : "free"
  return <span className={`badge badge-${key}`}>{PLAN_LABEL[key]}</span>
}

export function money(n: number | string) {
  return `R$ ${formatMoney(n)}`
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR")
}

export function fmtDateLong(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}
