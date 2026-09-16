import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { checkRateLimit } from "@/lib/rate-limit"
import { handlePrismaError } from "@/lib/api-error"
import {
  PlanChangeError,
  cancelPlanChangeRequest,
  createPlanChangeRequest,
  getPendingPlanChange,
  serializePlanChange,
} from "@/lib/plan-change"

const createSchema = z.object({
  plan: z.enum(["free", "premium", "pro"]),
  billing: z.enum(["monthly", "annual"]).optional(),
  note: z.string().trim().max(200).optional(),
})

const PLAN_CHANGE_LIMIT = 8
const PLAN_CHANGE_WINDOW_MS = 60 * 60 * 1000

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, _count: { select: { videos: true } } },
  })
  const pending = await getPendingPlanChange(userId)

  return NextResponse.json({
    plan: user?.plan ?? "free",
    videoCount: user?._count.videos ?? 0,
    pendingRequest: pending ? serializePlanChange(pending) : null,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const rl = await checkRateLimit(`plan-change:${userId}`, PLAN_CHANGE_LIMIT, PLAN_CHANGE_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente de novo em instantes." },
      { status: 429 },
    )
  }

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

  try {
    const request = await createPlanChangeRequest({
      userId,
      toPlan: parsed.data.plan,
      billing: parsed.data.billing,
      note: parsed.data.note,
    })
    return NextResponse.json({ ok: true, request: serializePlanChange(request) }, { status: 201 })
  } catch (err) {
    if (err instanceof PlanChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const handled = handlePrismaError(err, { notFound: "Usuário não encontrado" })
    if (handled) return handled
    console.error("[plano] POST", err)
    return NextResponse.json({ error: "Não foi possível enviar a solicitação" }, { status: 500 })
  }
}

export async function DELETE() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  try {
    await cancelPlanChangeRequest(userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof PlanChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const handled = handlePrismaError(err)
    if (handled) return handled
    console.error("[plano] DELETE", err)
    return NextResponse.json({ error: "Não foi possível cancelar a solicitação" }, { status: 500 })
  }
}
