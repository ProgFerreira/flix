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
  const method = searchParams.get("method")

  const where: Prisma.PlanPaymentWhereInput = {}
  if (plan === "premium" || plan === "pro" || plan === "free") where.plan = plan
  if (method === "pix" || method === "card" || method === "boleto" || method === "manual") where.method = method
  if (q) {
    where.user = { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
  }

  const payments = await prisma.planPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX,
    include: { user: { select: { name: true, email: true } } },
  })

  const csv = toCsv(
    ["id", "cliente", "email", "plano", "cobranca", "valor", "metodo", "observacao", "comprovante", "data"],
    payments.map((p) => [
      p.id,
      p.user?.name ?? "",
      p.user?.email ?? "",
      p.plan,
      p.billing,
      p.amount.toString(),
      p.method,
      p.note ?? "",
      p.receiptPath ? "sim" : "nao",
      p.createdAt.toISOString(),
    ]),
  )
  const { body, headers } = csvResponse(`pagamentos-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  await logAdminAction({
    adminId: auth.userId,
    action: "export.pagamentos",
    targetType: "export",
    meta: { q, plan, method, count: payments.length },
  })
  return new NextResponse(body, { headers })
}
