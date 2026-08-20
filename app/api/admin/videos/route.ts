import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const videos = await prisma.video.findMany({
    where: { source: "upload" },
    include: { videoCategories: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(videos)
}
