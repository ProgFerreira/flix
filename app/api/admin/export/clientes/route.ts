import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { toCsv, csvResponse } from "@/lib/csv"
import { logAdminAction } from "@/lib/audit"

const MAX = 5000

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const plan = searchParams.get("plan")
  const status = searchParams.get("status")
  const role = searchParams.get("role")

  const where: Prisma.UserWhereInput = { deletadoEm: null }
  if (plan === "free" || plan === "premium" || plan === "pro") where.plan = plan
  if (status === "active" || status === "blocked") where.status = status
  if (role === "user" || role === "admin") where.role = role
  if (q) {
    where.OR = [{ email: { contains: q } }, { name: { contains: q } }]
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX,
    select: {
      id: true, name: true, email: true, phone: true, role: true, plan: true, status: true,
      createdAt: true, emailVerifiedAt: true,
      subscription: { select: { status: true, nextBillingDate: true, billing: true } },
    },
  })

  const csv = toCsv(
    ["id", "nome", "email", "whatsapp", "papel", "plano", "status", "email_confirmado", "assinatura", "proximo_vencimento", "cadastro"],
    users.map((u) => [
      u.id,
      u.name ?? "",
      u.email,
      u.phone ?? "",
      u.role,
      u.plan,
      u.status,
      u.emailVerifiedAt ? "sim" : "nao",
      u.subscription?.status ?? "",
      u.subscription?.nextBillingDate?.toISOString().slice(0, 10) ?? "",
      u.createdAt.toISOString().slice(0, 10),
    ]),
  )
  const { body, headers } = csvResponse(`clientes-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  await logAdminAction({
    adminId: auth.userId,
    action: "export.clientes",
    targetType: "export",
    meta: { q, plan, status, role, count: users.length },
  })
  return new NextResponse(body, { headers })
}
