import { NextResponse } from "next/server"
import { statfs } from "node:fs/promises"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { ffmpegAvailable } from "@/lib/ffmpeg"
import { readJobStatus } from "@/lib/job-status"

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  try {
    const [disk, ffmpeg, processing, failed, stale, billing, videos] = await Promise.all([
      statfs(process.cwd()).catch(() => null), ffmpegAvailable(),
      prisma.video.count({ where: { source: "upload", status: "processing" } }),
      prisma.video.count({ where: { source: "upload", status: "error" } }),
      prisma.video.count({ where: { source: "upload", status: "processing", createdAt: { lt: new Date(Date.now() - 3 * 60 * 60 * 1000) } } }),
      readJobStatus("billing"), readJobStatus("videos"),
    ])
    return NextResponse.json({ ffmpeg, processing, failed, stale, freeBytes: disk ? disk.bavail * disk.bsize : null, jobs: { billing, videos } }, { headers: { "Cache-Control": "private, no-store" } })
  } catch { return NextResponse.json({ error: "Não foi possível consultar a operação." }, { status: 503 }) }
}
