import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      plan: true,
      role: true,
      status: true,
      createdAt: true,
      emailVerifiedAt: true,
      consentimentos: {
        select: { tipo: true, aceito: true, versao: true, ip: true, criadoEm: true },
        orderBy: { criadoEm: "desc" },
      },
      subscription: {
        select: {
          plan: true,
          billing: true,
          amount: true,
          status: true,
          startDate: true,
          nextBillingDate: true,
          cancelledAt: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          plan: true,
          billing: true,
          amount: true,
          method: true,
          createdAt: true,
        },
      },
      videos: {
        select: { id: true, title: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      },
    },
  })
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const body = JSON.stringify({
    ...user,
    subscription: user.subscription
      ? { ...user.subscription, amount: user.subscription.amount.toString() }
      : null,
    payments: user.payments.map((p) => ({ ...p, amount: p.amount.toString() })),
  })

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="flix-dados-${userId}.json"`,
    },
  })
}
