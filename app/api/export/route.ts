import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const [videos, categories] = await Promise.all([
    prisma.video.findMany({
      where: { userId },
      include: { videoCategories: { include: { category: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    categories,
    videos: videos.map((v) => ({
      ...v,
      categories: v.videoCategories.map((vc) => vc.category),
      videoCategories: undefined,
    })),
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="flix-export-${Date.now()}.json"`,
    },
  })
}
