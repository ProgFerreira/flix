import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const subs = await prisma.subscription.findMany({
    orderBy: { nextBillingDate: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  // Marca como overdue automaticamente
  const today = new Date()
  const updated = subs.map(s => ({
    ...s,
    status: s.status === "active" && s.nextBillingDate < today ? "overdue" : s.status,
  }))

  return NextResponse.json(updated)
}
