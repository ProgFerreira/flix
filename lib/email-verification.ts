import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateResetToken, hashResetToken, isResetTokenValid } from "@/lib/password-reset"
import { sendVerificationEmail } from "@/lib/email"

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export function generateVerificationToken(now = new Date()) {
  return generateResetToken(now, VERIFY_TOKEN_TTL_MS)
}

export { hashResetToken, isResetTokenValid }

/**
 * Invalida tokens anteriores e manda um link novo. Falha de e-mail não
 * derruba o cadastro — o usuário pode reenviar depois em /conta.
 */
export async function issueEmailVerification(userId: number, email: string): Promise<void> {
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })
  const { token, tokenHash, expiresAt } = generateVerificationToken()
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } })
  const url = `${process.env.NEXTAUTH_URL ?? ""}/verificar-email?token=${token}`
  await sendVerificationEmail(email, url).catch((err) => {
    console.error("[email-verification] falha ao enviar e-mail:", err)
  })
}

/** Publish/upload exigem e-mail confirmado. Admin passa. */
export async function requireVerifiedEmail(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, role: true },
  })
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (user.role === "admin" || user.emailVerifiedAt) return { ok: true as const }
  return NextResponse.json({ error: "Confirme seu e-mail para publicar conteúdo." }, { status: 403 })
}
