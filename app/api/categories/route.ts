import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  color: z.string().default("#e85d04"),
})

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const categories = await prisma.category.findMany({
    where: { userId },
    include: { _count: { select: { videoCategories: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const category = await prisma.category.create({ data: { ...parsed.data, userId } })
    return NextResponse.json(category)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Você já tem uma categoria com esse nome" }, { status: 409 })
    }
    throw err
  }
}
