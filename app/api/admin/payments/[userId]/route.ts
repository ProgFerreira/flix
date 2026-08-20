import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId } = await params

  const [payments, user] = await Promise.all([
    prisma.planPayment.findMany({
      where: { userId: Number(userId) },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, name: true, email: true, plan: true, _count: { select: { videos: true } } },
    }),
  ])

  return NextResponse.json({ payments, user })
}
