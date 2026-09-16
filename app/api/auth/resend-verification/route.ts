import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { issueEmailVerification } from "@/lib/email-verification"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const RESEND_LIMIT = 3
const RESEND_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`verify-email:${ip}:${userId}`, RESEND_LIMIT, RESEND_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Aguarde um pouco antes de pedir outro e-mail." }, { status: 429 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  })
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true })

  await issueEmailVerification(userId, user.email)
  return NextResponse.json({ ok: true })
}
