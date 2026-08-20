import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  name: z.string().min(1, "Nome obrigatório").optional(),
})

// 5 contas novas por IP a cada hora — trava criação de conta em massa sem
// incomodar alguém criando uma ou duas contas de verdade.
const SIGNUP_LIMIT = 5
const SIGNUP_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    const rl = checkRateLimit(`signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Muitas contas criadas nesse endereço em pouco tempo. Tente de novo mais tarde." },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Dados inválidos"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 })

    const hashed = await bcrypt.hash(parsed.data.password, 10)
    const user = await prisma.user.create({
      data: { email: parsed.data.email, password: hashed, name: parsed.data.name },
      select: { id: true, email: true, name: true },
    })

    return NextResponse.json(user)
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar a conta. Verifique o banco de dados." },
      { status: 500 },
    )
  }
}
