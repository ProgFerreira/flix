export const UPCOMING_REMINDER_DAYS = 7

export type ReminderSub = {
  status: string
  nextBillingDate: Date
  lastReminderType: string | null
  lastReminderAt: Date | null
}

export function daysUntilBilling(now: Date, nextBillingDate: Date): number {
  return Math.ceil((nextBillingDate.getTime() - now.getTime()) / 86_400_000)
}

export function shouldSendUpcomingReminder(now: Date, sub: ReminderSub): boolean {
  if (sub.status !== "active") return false
  const days = daysUntilBilling(now, sub.nextBillingDate)
  if (days < 1 || days > UPCOMING_REMINDER_DAYS) return false
  const windowStart = new Date(sub.nextBillingDate)
  windowStart.setDate(windowStart.getDate() - UPCOMING_REMINDER_DAYS)
  if (sub.lastReminderType === "upcoming" && sub.lastReminderAt && sub.lastReminderAt >= windowStart) {
    return false
  }
  return true
}

export function shouldSendOverdueReminder(now: Date, sub: ReminderSub): boolean {
  if (sub.status !== "overdue") return false
  if (now <= sub.nextBillingDate) return false
  if (sub.lastReminderType === "overdue" && sub.lastReminderAt && sub.lastReminderAt > sub.nextBillingDate) {
    return false
  }
  return true
}
