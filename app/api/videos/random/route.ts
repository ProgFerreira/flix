import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { serializeVideo } from "@/lib/serialize-video"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const unwatched = await prisma.video.findMany({
    where: { userId, watched: false, source: "youtube" },
    include: { videoCategories: { include: { category: true } } },
  })

  if (unwatched.length === 0) return NextResponse.json({ error: "Nenhum vídeo não assistido" }, { status: 404 })

  const random = unwatched[Math.floor(Math.random() * unwatched.length)]
  return NextResponse.json(serializeVideo(random))
}
