import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { AUDIT_ACTIONS } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const paging = parsePageParams(searchParams, 20)

  const where = action && AUDIT_ACTIONS.includes(action as typeof AUDIT_ACTIONS[number]) ? { action } : {}

  const [total, items] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.take,
      include: { admin: { select: { id: true, name: true, email: true } } },
    }),
  ])

  return NextResponse.json(paginated(items.map((row) => ({
    ...row,
    meta: row.meta ? safeJson(row.meta) : null,
  })), total, paging.page, paging.pageSize))
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
