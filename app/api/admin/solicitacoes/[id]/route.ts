import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/session"
import { parsePositiveInt } from "@/lib/admin-users"
import { handlePrismaError } from "@/lib/api-error"
import { PlanChangeError, reviewPlanChangeRequest, serializePlanChange } from "@/lib/plan-change"
import { logAdminAction } from "@/lib/audit"

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  method: z.enum(["pix", "card", "boleto", "manual"]).optional(),
  note: z.string().trim().max(200).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const requestId = parsePositiveInt(id)
  if (!requestId) {
    return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const request = await reviewPlanChangeRequest({
      requestId,
      adminId,
      action: parsed.data.action,
      method: parsed.data.method,
      note: parsed.data.note,
    })
    await logAdminAction({
      adminId,
      action: parsed.data.action === "approve" ? "plan_change.approve" : "plan_change.reject",
      targetType: "plan_change",
      targetId: requestId,
      meta: { userId: request.userId, toPlan: request.toPlan },
    })
    return NextResponse.json({ ok: true, request: serializePlanChange(request) })
  } catch (err) {
    if (err instanceof PlanChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const handled = handlePrismaError(err, { notFound: "Solicitação não encontrada" })
    if (handled) return handled
    throw err
  }
}
