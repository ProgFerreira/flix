import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

/**
 * Traduz os erros mais comuns do Prisma pra uma resposta HTTP decente, em
 * vez de deixar virar 500 genérico sem explicação. Usar assim:
 *
 *   try { ... } catch (err) {
 *     const handled = handlePrismaError(err)
 *     if (handled) return handled
 *     throw err
 *   }
 *
 * Retorna null quando o erro não é um dos casos conhecidos — o chamador
 * deve relançar (`throw err`) pra não engolir erro de verdade.
 */
export function handlePrismaError(
  err: unknown,
  messages?: { duplicate?: string; notFound?: string; referenced?: string },
): NextResponse | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null

  if (err.code === "P2002") {
    return NextResponse.json({ error: messages?.duplicate ?? "Já existe um registro com esses dados" }, { status: 409 })
  }
  if (err.code === "P2025") {
    return NextResponse.json({ error: messages?.notFound ?? "Registro não encontrado" }, { status: 404 })
  }
  if (err.code === "P2003") {
    // Foreign key real bloqueando a operação — outra linha ainda referencia
    // esta (ex: usuário dono de uma coleção que não tem onDelete: Cascade).
    return NextResponse.json({ error: messages?.referenced ?? "Não é possível concluir: existem outros registros vinculados a este." }, { status: 409 })
  }
  return null
}
