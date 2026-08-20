import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

const schema = z.object({ name: z.string().min(1) })

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const collections = await prisma.collection.findMany({
    where: { members: { some: { userId } } },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
      _count: { select: { videos: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(collections.map(c => ({
    ...c,
    myRole: c.members.find(m => m.userId === userId)?.role ?? "viewer",
  })))
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const collection = await prisma.collection.create({
    data: {
      name: parsed.data.name,
      ownerId: userId,
      members: { create: { userId, role: "owner" } },
    },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
      _count: { select: { videos: true } },
    },
  })

  return NextResponse.json({ ...collection, myRole: "owner" })
}
