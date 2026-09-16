import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashResetToken, isResetTokenValid } from "@/lib/email-verification"

const schema = z.object({ token: z.string().min(1) })

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Link inválido" }, { status: 400 })

  const tokenHash = hashResetToken(parsed.data.token)
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } })
  if (!record || !isResetTokenValid(record)) {
    return NextResponse.json({ error: "Link inválido ou expirado. Peça um novo em Conta." }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
