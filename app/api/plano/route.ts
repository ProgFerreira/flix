import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, _count: { select: { videos: true } } },
  })

  return NextResponse.json({ plan: user?.plan ?? "free", videoCount: user?._count.videos ?? 0 })
}
