import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { isShareToken, toPublicCollection } from "@/lib/collection-share"

const PUBLIC_GET_LIMIT = 60
const PUBLIC_GET_WINDOW_MS = 60 * 1000

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`public-collection:${ip}`, PUBLIC_GET_LIMIT, PUBLIC_GET_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Tente de novo em instantes." }, { status: 429 })
  }

  const { token } = await params
  if (!isShareToken(token)) {
    return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 })
  }

  const collection = await prisma.collection.findUnique({
    where: { shareToken: token },
    select: {
      name: true,
      isPublic: true,
      owner: { select: { name: true } },
      videos: {
        orderBy: { addedAt: "desc" },
        select: {
          video: {
            select: {
              title: true,
              thumbnail: true,
              duration: true,
              channelName: true,
              source: true,
              videoId: true,
            },
          },
        },
      },
    },
  })

  if (!collection || !collection.isPublic) {
    return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 })
  }

  return NextResponse.json(toPublicCollection(
    collection.name,
    collection.owner.name,
    collection.videos.map((row) => row.video),
  ))
}
