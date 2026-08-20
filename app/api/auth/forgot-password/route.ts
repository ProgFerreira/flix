import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generateResetToken } from "@/lib/password-reset"
import { sendPasswordResetEmail } from "@/lib/email"

const schema = z.object({ email: z.string().email("Email inválido") })

const GENERIC_RESPONSE = { ok: true, message: "Se esse e-mail tiver uma conta, enviamos um link de redefinição." }

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true } })

  // Sempre a mesma resposta, exista ou não a conta — não dá pra alguém
  // descobrir quais e-mails têm cadastro tentando um por um.
  if (user) {
    const { token, tokenHash, expiresAt } = generateResetToken()
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
    const resetUrl = `${process.env.NEXTAUTH_URL ?? ""}/redefinir-senha?token=${token}`
    await sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      console.error("[forgot-password] falha ao enviar e-mail:", err)
    })
  }

  return NextResponse.json(GENERIC_RESPONSE)
}
