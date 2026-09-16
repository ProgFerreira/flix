import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { runBillingMaintenance } from "@/lib/billing"
import { logAdminAction } from "@/lib/audit"

export async function POST() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const result = await runBillingMaintenance()
  await logAdminAction({
    adminId,
    action: "billing.sync",
    targetType: "billing",
    meta: result,
  })
  return NextResponse.json({ ok: true, ...result })
}
