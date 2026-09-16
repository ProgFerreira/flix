import { prisma } from "@/lib/prisma"
import { getClientIp } from "@/lib/rate-limit"

export type AuditAction =
  | "user.create"
  | "user.update"
  | "user.delete"
  | "payment.create"
  | "payment.receipt"
  | "plan_change.approve"
  | "plan_change.reject"
  | "subscription.renew"
  | "subscription.cancel"
  | "subscription.reactivate"
  | "billing.sync"
  | "video.upload"
  | "video.update"
  | "video.delete"
  | "course.create"
  | "course.update"
  | "course.delete"
  | "export.clientes"
  | "export.pagamentos"
  | "auth.login"
  | "auth.login_fail"

export type AuditTarget = "user" | "payment" | "subscription" | "plan_change" | "billing" | "video" | "course" | "export" | "auth"

export const AUDIT_ACTIONS: AuditAction[] = [
  "user.create",
  "user.update",
  "user.delete",
  "payment.create",
  "payment.receipt",
  "plan_change.approve",
  "plan_change.reject",
  "subscription.renew",
  "subscription.cancel",
  "subscription.reactivate",
  "billing.sync",
  "video.upload",
  "video.update",
  "video.delete",
  "course.create",
  "course.update",
  "course.delete",
  "export.clientes",
  "export.pagamentos",
  "auth.login",
  "auth.login_fail",
]

async function requestIp(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const ip = getClientIp(h)
    return ip === "unknown" ? undefined : ip
  } catch {
    return undefined
  }
}

export async function logAdminAction(opts: {
  adminId?: number | null
  action: AuditAction
  targetType: AuditTarget
  targetId?: number | null
  meta?: Record<string, unknown>
}) {
  try {
    const ip = typeof opts.meta?.ip === "string" ? opts.meta.ip : await requestIp()
    const meta = ip ? { ...opts.meta, ip } : opts.meta
    await prisma.adminAuditLog.create({
      data: {
        adminId: opts.adminId ?? null,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
  } catch (err) {
    console.error("[audit] falha ao gravar ação", opts.action, err)
  }
}
