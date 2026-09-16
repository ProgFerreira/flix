import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin, computeSubscriptionStatus } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { handlePrismaError } from "@/lib/api-error"
import { applyPlanChange } from "@/lib/admin-users"
import { logAdminAction } from "@/lib/audit"
import { passwordSchema } from "@/validators/password"
import { parseOptionalWhatsAppPhone } from "@/lib/whatsapp"

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  plan: true,
  status: true,
  createdAt: true,
  emailVerifiedAt: true,
  _count: { select: { videos: true, payments: true } },
  subscription: {
    select: { id: true, plan: true, billing: true, amount: true, status: true, nextBillingDate: true },
  },
} as const

function withLiveSubscription<T extends { subscription: { status: string; nextBillingDate: Date } | null }>(
  user: T,
  now: Date,
) {
  if (!user.subscription) return user
  return {
    ...user,
    subscription: {
      ...user.subscription,
      status: computeSubscriptionStatus(now, user.subscription),
    },
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const plan = searchParams.get("plan")
  const status = searchParams.get("status")
  const role = searchParams.get("role")
  const paging = parsePageParams(searchParams, 20)

  const where: Prisma.UserWhereInput = { deletadoEm: null }
  if (plan === "free" || plan === "premium" || plan === "pro") where.plan = plan
  if (status === "active" || status === "blocked") where.status = status
  if (role === "user" || role === "admin") where.role = role
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { name: { contains: q } },
    ]
  }

  const [total, users, allCount, activeCount, blockedCount, freeCount, premiumCount, proCount] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.take,
      select: userSelect,
    }),
    prisma.user.count({ where: { deletadoEm: null } }),
    prisma.user.count({ where: { status: "active", deletadoEm: null } }),
    prisma.user.count({ where: { status: "blocked", deletadoEm: null } }),
    prisma.user.count({ where: { plan: "free", deletadoEm: null } }),
    prisma.user.count({ where: { plan: "premium", deletadoEm: null } }),
    prisma.user.count({ where: { plan: "pro", deletadoEm: null } }),
  ])

  const now = new Date()
  return NextResponse.json({
    ...paginated(users.map((u) => withLiveSubscription(u, now)), total, paging.page, paging.pageSize),
    stats: {
      total: allCount,
      active: activeCount,
      blocked: blockedCount,
      free: freeCount,
      premium: premiumCount,
      pro: proCount,
    },
  })
}

const createSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: passwordSchema,
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  phone: z.string().trim().max(24).optional(),
  plan: z.enum(["free", "premium", "pro"]).default("free"),
  role: z.enum(["user", "admin"]).default("user"),
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

  const phone = parseOptionalWhatsAppPhone(parsed.data.phone)
  if (!phone.ok) return NextResponse.json({ error: phone.error }, { status: 400 })

  const hashed = await bcrypt.hash(parsed.data.password, 10)
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        password: hashed,
        name: parsed.data.name,
        phone: phone.value,
        plan: parsed.data.plan,
        role: parsed.data.role,
        emailVerifiedAt: new Date(),
        criadoPorId: adminId,
      },
      select: {
        id: true, email: true, name: true, phone: true, role: true, plan: true, status: true, createdAt: true,
        emailVerifiedAt: true,
      },
    })
    if (parsed.data.plan !== "free") {
      await applyPlanChange(user.id, parsed.data.plan)
    }
    await logAdminAction({
      adminId,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      meta: { plan: parsed.data.plan, role: parsed.data.role },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    const handled = handlePrismaError(err, { duplicate: "Email já cadastrado" })
    if (handled) return handled
    throw err
  }
}
