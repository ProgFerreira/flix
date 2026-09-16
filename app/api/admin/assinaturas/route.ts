import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin, computeSubscriptionStatus } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"

function serializeSub(
  s: {
    amount: { toString(): string }
    status: string
    nextBillingDate: Date
    payments: { amount: { toString(): string } }[]
  },
  now: Date,
) {
  return {
    ...s,
    amount: s.amount.toString(),
    status: computeSubscriptionStatus(now, s),
    payments: s.payments.map((p) => ({ ...p, amount: p.amount.toString() })),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const status = searchParams.get("status")
  const paging = parsePageParams(searchParams, 20)

  const where: Prisma.SubscriptionWhereInput = {}
  if (status === "active" || status === "overdue" || status === "cancelled" || status === "expired") {
    where.status = status
  }
  if (q) {
    where.user = {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    }
  }

  const week = new Date()
  week.setDate(week.getDate() + 7)
  const now = new Date()

  const [total, rows, statusGroups, activeForMrr, upcomingRows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: { nextBillingDate: "asc" },
      skip: paging.skip,
      take: paging.take,
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.subscription.findMany({
      where: { status: "active" },
      select: { amount: true, billing: true },
    }),
    prisma.subscription.findMany({
      where: { status: "active", nextBillingDate: { lte: week } },
      take: 20,
      orderBy: { nextBillingDate: "asc" },
      include: { user: { select: { id: true, name: true, email: true, status: true } }, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ])

  const counts: Record<string, number> = { active: 0, overdue: 0, cancelled: 0, expired: 0 }
  let listed = 0
  for (const g of statusGroups) {
    counts[g.status] = g._count._all
    listed += g._count._all
  }

  const mrr = activeForMrr.reduce((acc, s) => {
    const amount = Number(String(s.amount))
    return acc + (s.billing === "annual" ? amount / 12 : amount)
  }, 0)

  return NextResponse.json({
    ...paginated(rows.map((s) => serializeSub(s, now)), total, paging.page, paging.pageSize),
    stats: {
      total: listed,
      active: counts.active,
      overdue: counts.overdue,
      cancelled: counts.cancelled,
      mrr,
      arr: mrr * 12,
    },
    upcoming: upcomingRows.map((s) => serializeSub(s, now)),
  })
}
