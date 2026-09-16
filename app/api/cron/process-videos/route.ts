import { recordJobStatus } from "@/lib/job-status"
import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron-auth"
import { enqueueVideoProcessing, listDueVideoIds } from "@/lib/video-process"

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const ids = await listDueVideoIds().catch(async error => { await recordJobStatus("videos", false); throw error })
  await recordJobStatus("videos", true)
  for (const id of ids) enqueueVideoProcessing(id)
  return NextResponse.json({ ok: true, queued: ids.length })
}
