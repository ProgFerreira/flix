import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const SEARCH_LIMIT = 40
const SEARCH_WINDOW_MS = 60 * 1000

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`user-search:${auth.userId}:${ip}`, SEARCH_LIMIT, SEARCH_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas em pouco tempo. Tente de novo mais tarde." },
      { status: 429 },
    )
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json([])

  const users = await prisma.user.findMany({
    where: {
      status: "active",
      deletadoEm: null,
      id: { not: auth.userId },
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, plan: true },
    take: 8,
    orderBy: { name: "asc" },
  })

  return NextResponse.json(users)
}
