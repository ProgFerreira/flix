import { recordJobStatus } from "@/lib/job-status"
import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron-auth"
import { runBillingMaintenance } from "@/lib/billing"

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  const result = await runBillingMaintenance().catch(async error => { await recordJobStatus("billing", false); throw error })
  await recordJobStatus("billing", true)
  return NextResponse.json({ ok: true, ...result })
}
