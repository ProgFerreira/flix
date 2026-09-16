import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { hashResetToken, isResetTokenValid } from "@/lib/password-reset"
import { resetPasswordSchema } from "@/validators/auth"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const tokenHash = hashResetToken(parsed.data.token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || !isResetTokenValid(record)) {
    return NextResponse.json({ error: "Link inválido ou expirado. Peça um novo." }, { status: 400 })
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
