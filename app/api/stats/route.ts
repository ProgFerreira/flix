import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"

function parseDurationToSeconds(duration: string | null | undefined): number {
  if (!duration) return 0
  const d = duration.trim()
  const minsec = d.match(/^(\d+)m(\d+)s$/)
  if (minsec) return parseInt(minsec[1]) * 60 + parseInt(minsec[2])
  const parts = d.split(":").map(Number)
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0)
  return 0
}

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const videos = await prisma.video.findMany({
    where: { userId },
    include: { videoCategories: { include: { category: true } } },
  })

  const total = videos.length
  const watched = videos.filter((v) => v.watched).length
  const unwatched = total - watched
  const favorites = videos.filter((v) => v.favorite).length
  const totalSeconds = videos.reduce((acc, v) => acc + parseDurationToSeconds(v.duration), 0)
  const totalMinutes = Math.round(totalSeconds / 60)

  const catCount: Record<number, { name: string; color: string; count: number }> = {}
  for (const v of videos) {
    for (const vc of v.videoCategories) {
      const cid = vc.category.id
      if (!catCount[cid]) catCount[cid] = { name: vc.category.name, color: vc.category.color, count: 0 }
      catCount[cid].count++
    }
  }
  const topCategories = Object.values(catCount).sort((a, b) => b.count - a.count).slice(0, 5)

  const channelCount: Record<string, number> = {}
  for (const v of videos) {
    if (v.channelName) channelCount[v.channelName] = (channelCount[v.channelName] ?? 0) + 1
  }
  const topChannels = Object.entries(channelCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  const monthCount: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthCount[key] = 0
  }
  for (const v of videos) {
    const d = new Date(v.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (key in monthCount) monthCount[key]++
  }
  const byMonth = Object.entries(monthCount).map(([month, count]) => ({ month, count }))

  return NextResponse.json({ total, watched, unwatched, favorites, totalMinutes, topCategories, topChannels, byMonth })
}
