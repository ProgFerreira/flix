import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { serializeVideo } from "@/lib/serialize-video"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const shares = await prisma.videoShare.findMany({
    where: { toUserId: userId },
    include: {
      video: {
        include: { videoCategories: { include: { category: true } }, user: { select: { id: true, email: true, name: true } } },
      },
    },
  })

  return NextResponse.json(shares.map(s => ({ ...serializeVideo(s.video), permission: s.permission, sharedBy: s.video.user })))
}
