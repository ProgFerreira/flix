import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin, PLAN_PRICES, calcNextBilling } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { handlePrismaError } from "@/lib/api-error"
import { serializePayment } from "@/lib/serialize-payment"
import { logAdminAction } from "@/lib/audit"

const createSchema = z.object({
  userId: z.number().int().positive(),
  plan: z.enum(["premium", "pro", "free"]),
  billing: z.enum(["monthly", "annual"]).default("monthly"),
  method: z.enum(["pix", "card", "boleto", "manual"]).default("manual"),
  note: z.string().trim().max(200).optional(),
  amount: z.number().finite().min(0).max(999999).optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { userId, plan, billing, method, note, amount: customAmount, idempotencyKey } = parsed.data

  if (idempotencyKey) {
    const replay = await prisma.planPayment.findUnique({ where: { idempotencyKey } })
    if (replay) return NextResponse.json({ ok: true, replayed: true, payment: serializePayment(replay) })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

  const amount = customAmount ?? (plan !== "free" ? (PLAN_PRICES[plan]?.[billing] ?? 0) : 0)
  const nextBillingDate = calcNextBilling(billing)

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (plan === "free") {
        await tx.user.update({ where: { id: userId }, data: { plan: "free" } })
        await tx.subscription.updateMany({
          where: { userId, status: { not: "cancelled" } },
          data: { status: "cancelled", cancelledAt: new Date() },
        })
        return { ok: true as const }
      }

      const existing = await tx.subscription.findUnique({ where: { userId } })
      const subscription = existing
        ? await tx.subscription.update({
            where: { userId },
            data: { plan, billing, amount, status: "active", nextBillingDate, cancelledAt: null },
          })
        : await tx.subscription.create({
            data: { userId, plan, billing, amount, nextBillingDate, status: "active" },
          })

      await tx.user.update({ where: { id: userId }, data: { plan } })
      const payment = await tx.planPayment.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          plan,
          billing,
          amount,
          method,
          note: note || null,
          idempotencyKey: idempotencyKey ?? null,
          criadoPorId: adminId,
        },
      })
      return { ok: true as const, payment }
    })

    await logAdminAction({
      adminId,
      action: "payment.create",
      targetType: "payment",
      targetId: result.payment?.id ?? userId,
      meta: { userId, plan, billing, amount },
    })
    return NextResponse.json(
      result.payment ? { ok: true, payment: serializePayment(result.payment) } : { ok: true },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && idempotencyKey) {
      const replay = await prisma.planPayment.findUnique({ where: { idempotencyKey } })
      if (replay) return NextResponse.json({ ok: true, replayed: true, payment: serializePayment(replay) })
    }
    const handled = handlePrismaError(err, { notFound: "Usuário não encontrado" })
    if (handled) return handled
    throw err
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const plan = searchParams.get("plan")
  const method = searchParams.get("method")
  const paging = parsePageParams(searchParams, 20)

  const where: Prisma.PlanPaymentWhereInput = {}
  if (plan === "premium" || plan === "pro" || plan === "free") where.plan = plan
  if (method === "pix" || method === "card" || method === "boleto" || method === "manual") where.method = method
  if (q) {
    where.user = {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    }
  }

  const [total, payments, totals] = await Promise.all([
    prisma.planPayment.count({ where }),
    prisma.planPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.take,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.planPayment.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return NextResponse.json({
    ...paginated(payments.map(serializePayment), total, paging.page, paging.pageSize),
    stats: {
      count: totals._count,
      revenue: totals._sum.amount?.toString() ?? "0",
    },
  })
}
