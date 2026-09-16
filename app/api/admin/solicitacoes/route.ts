import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { serializePlanChange } from "@/lib/plan-change"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const status = searchParams.get("status")
  const paging = parsePageParams(searchParams, 20)

  const where: Prisma.PlanChangeRequestWhereInput = {}
  if (status === "pending" || status === "approved" || status === "rejected" || status === "cancelled") {
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

  const [total, items, pendingCount] = await Promise.all([
    prisma.planChangeRequest.count({ where }),
    prisma.planChangeRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: paging.skip,
      take: paging.take,
      include: {
        user: { select: { id: true, name: true, email: true, plan: true, status: true } },
      },
    }),
    prisma.planChangeRequest.count({ where: { status: "pending" } }),
  ])

  return NextResponse.json({
    ...paginated(items.map(serializePlanChange), total, paging.page, paging.pageSize),
    stats: { pending: pendingCount },
  })
}
