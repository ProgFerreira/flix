import type { Prisma } from "@prisma/client"

export type MoneyInput = Prisma.Decimal | number | string | { toString(): string }

export function moneyToNumber(value: MoneyInput): number {
  if (typeof value === "number") return value
  const n = Number(value.toString())
  return Number.isFinite(n) ? n : 0
}

export function formatMoney(value: MoneyInput): string {
  return moneyToNumber(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
