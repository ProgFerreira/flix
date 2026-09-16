import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAdmin, computeSubscriptionStatus } from "@/lib/session"
import { handlePrismaError } from "@/lib/api-error"
import { deleteUserAccount } from "@/lib/delete-user"
import { applyPlanChange, countOtherActiveAdmins, parsePositiveInt } from "@/lib/admin-users"
import { Prisma } from "@prisma/client"
import { getPendingPlanChange, serializePlanChange } from "@/lib/plan-change"
import { serializePayment } from "@/lib/serialize-payment"
import { logAdminAction } from "@/lib/audit"
import { passwordSchema } from "@/validators/password"
import { parseOptionalWhatsAppPhone } from "@/lib/whatsapp"

const patchSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80).optional(),
  email: z.string().trim().email("Email inválido").optional(),
  phone: z.string().trim().max(24).optional(),
  password: passwordSchema.optional(),
  status: z.enum(["active", "blocked"]).optional(),
  plan: z.enum(["free", "premium", "pro"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
}).refine(
  (d) =>
    d.name !== undefined
    || d.email !== undefined
    || d.phone !== undefined
    || d.password !== undefined
    || d.status !== undefined
    || d.plan !== undefined
    || d.role !== undefined,
  { message: "Informe ao menos um campo para atualizar" },
)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const targetId = parsePositiveInt(id)
  if (!targetId) {
    return NextResponse.json({ error: "Usuário inválido" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      plan: true,
      status: true,
      createdAt: true,
      emailVerifiedAt: true,
      deletadoEm: true,
      _count: { select: { videos: true, payments: true } },
      subscription: true,
      payments: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  })
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  const { payments, subscription, deletadoEm, ...rest } = user
  if (deletadoEm) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  const pending = await getPendingPlanChange(targetId)
  return NextResponse.json({
    user: rest,
    subscription: subscription
      ? { ...subscription, amount: subscription.amount.toString(), status: computeSubscriptionStatus(new Date(), subscription) }
      : null,
    payments: payments.map(serializePayment),
    pendingRequest: pending ? serializePlanChange(pending) : null,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const targetId = parsePositiveInt(id)
  if (!targetId) {
    return NextResponse.json({ error: "Usuário inválido" }, { status: 400 })
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

  const phone = parsed.data.phone !== undefined
    ? parseOptionalWhatsAppPhone(parsed.data.phone)
    : null
  if (phone && !phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 })

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true, plan: true, deletadoEm: true },
  })
  if (!target || target.deletadoEm) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

  if (targetId === adminId && parsed.data.status === "blocked") {
    return NextResponse.json({ error: "Você não pode bloquear a própria conta" }, { status: 400 })
  }
  if (targetId === adminId && parsed.data.role === "user") {
    return NextResponse.json({ error: "Você não pode remover o próprio acesso de administrador" }, { status: 400 })
  }

  const wouldBlockAdmin = parsed.data.status === "blocked" && target.role === "admin" && target.status === "active"
  const wouldDemoteAdmin = parsed.data.role === "user" && target.role === "admin"
  if (wouldBlockAdmin || wouldDemoteAdmin) {
    const others = await countOtherActiveAdmins(targetId)
    if (others === 0) {
      return NextResponse.json({ error: "Não é possível remover o último administrador ativo" }, { status: 400 })
    }
  }

  const data: Prisma.UserUpdateInput = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.email !== undefined) {
    data.email = parsed.data.email
    data.emailVerifiedAt = new Date()
  }
  if (phone?.ok) data.phone = phone.value
  if (parsed.data.password) data.password = await bcrypt.hash(parsed.data.password, 10)
  if (parsed.data.status) data.status = parsed.data.status
  if (parsed.data.role) data.role = parsed.data.role

  try {
    if (parsed.data.plan && parsed.data.plan !== target.plan) {
      await applyPlanChange(targetId, parsed.data.plan)
    }
    const user = Object.keys(data).length
      ? await prisma.user.update({ where: { id: targetId }, data })
      : await prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    await logAdminAction({
      adminId,
      action: "user.update",
      targetType: "user",
      targetId,
      meta: {
        fields: Object.keys(parsed.data).filter((k) => k !== "password"),
        passwordChanged: Boolean(parsed.data.password),
      },
    })
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        plan: user.plan,
        role: user.role,
      },
    })
  } catch (err) {
    const handled = handlePrismaError(err, { duplicate: "Email já cadastrado", notFound: "Usuário não encontrado" })
    if (handled) return handled
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const targetId = parsePositiveInt(id)
  if (!targetId) {
    return NextResponse.json({ error: "Usuário inválido" }, { status: 400 })
  }

  if (targetId === adminId) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true, status: true, deletadoEm: true },
  })
  if (!target || target.deletadoEm) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
  if (target.role === "admin" && target.status === "active") {
    const others = await countOtherActiveAdmins(targetId)
    if (others === 0) {
      return NextResponse.json({ error: "Não é possível excluir o último administrador ativo" }, { status: 400 })
    }
  }

  try {
    await deleteUserAccount(targetId)
    await logAdminAction({ adminId, action: "user.delete", targetType: "user", targetId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const handled = handlePrismaError(err, {
      notFound: "Usuário não encontrado",
      referenced: "Não foi possível excluir este usuário porque ainda há registros vinculados a ele.",
    })
    if (handled) return handled
    throw err
  }
}
