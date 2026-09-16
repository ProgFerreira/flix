import { prisma } from "@/lib/prisma"
import { syncSubscriptionStatus } from "@/lib/session"
import { sendBillingOverdueEmail, sendBillingUpcomingEmail } from "@/lib/email"
import { daysUntilBilling, shouldSendOverdueReminder, shouldSendUpcomingReminder } from "@/lib/billing-reminders"

export type BillingMaintenanceResult = {
  checked: number
  changed: number
  upcomingSent: number
  overdueSent: number
}

export async function runBillingMaintenance(now = new Date()): Promise<BillingMaintenanceResult> {
  const result: BillingMaintenanceResult = { checked: 0, changed: 0, upcomingSent: 0, overdueSent: 0 }

  const due = await prisma.subscription.findMany({
    where: { status: { in: ["active", "overdue"] } },
    select: { userId: true, status: true },
  })
  result.checked = due.length

  for (const row of due) {
    const before = row.status
    const updated = await syncSubscriptionStatus(row.userId)
    if (updated && updated.status !== before) result.changed += 1
  }

  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["active", "overdue"] } },
    include: { user: { select: { email: true, name: true, status: true } } },
  })

  for (const sub of subs) {
    if (sub.user.status === "blocked") continue
    const snapshot = {
      status: sub.status,
      nextBillingDate: sub.nextBillingDate,
      lastReminderType: sub.lastReminderType,
      lastReminderAt: sub.lastReminderAt,
    }
    try {
      if (shouldSendUpcomingReminder(now, snapshot)) {
        const daysLeft = daysUntilBilling(now, sub.nextBillingDate)
        await sendBillingUpcomingEmail({
          to: sub.user.email,
          name: sub.user.name,
          plan: sub.plan,
          amount: sub.amount.toString(),
          dueDate: sub.nextBillingDate,
          daysLeft,
        })
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { lastReminderType: "upcoming", lastReminderAt: now },
        })
        result.upcomingSent += 1
      } else if (shouldSendOverdueReminder(now, snapshot)) {
        await sendBillingOverdueEmail({
          to: sub.user.email,
          name: sub.user.name,
          plan: sub.plan,
          amount: sub.amount.toString(),
          dueDate: sub.nextBillingDate,
        })
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { lastReminderType: "overdue", lastReminderAt: now },
        })
        result.overdueSent += 1
      }
    } catch (err) {
      console.error("[billing] falha ao lembrar", sub.userId, err)
    }
  }

  return result
}
