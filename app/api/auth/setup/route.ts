import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { issueEmailVerification } from "@/lib/email-verification"
import { signupSchema } from "@/validators/auth"
import { CONSENTIMENTO_TIPOS, TERMS_VERSION } from "@/lib/lgpd"

const SIGNUP_LIMIT = 5
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    const rl = await checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas contas criadas nesse endereço em pouco tempo. Tente de novo mais tarde." },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing && !existing.deletadoEm) {
      return NextResponse.json(
        { error: "Não foi possível criar a conta. Tente entrar ou use outro e-mail." },
        { status: 400 },
      )
    }

    const hashed = await bcrypt.hash(parsed.data.password, 10)
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        password: hashed,
        name: parsed.data.name,
        consentimentos: {
          create: CONSENTIMENTO_TIPOS.map((tipo) => ({
            tipo,
            aceito: true,
            versao: TERMS_VERSION,
            ip,
          })),
        },
      },
      select: { id: true, email: true, name: true },
    })

    await issueEmailVerification(user.id, user.email)

    return NextResponse.json(user)
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar a conta. Verifique o banco de dados." },
      { status: 500 },
    )
  }
}
