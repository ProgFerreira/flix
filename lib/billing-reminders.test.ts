import { describe, it, expect } from "vitest"
import { shouldSendUpcomingReminder, shouldSendOverdueReminder } from "@/lib/billing-reminders"

const due = new Date("2026-02-10T00:00:00Z")

describe("shouldSendUpcomingReminder", () => {
  it("sends when the due date is within 7 days", () => {
    const now = new Date("2026-02-05T00:00:00Z")
    expect(shouldSendUpcomingReminder(now, {
      status: "active", nextBillingDate: due, lastReminderType: null, lastReminderAt: null,
    })).toBe(true)
  })

  it("does not send twice in the same window", () => {
    const now = new Date("2026-02-05T00:00:00Z")
    expect(shouldSendUpcomingReminder(now, {
      status: "active",
      nextBillingDate: due,
      lastReminderType: "upcoming",
      lastReminderAt: new Date("2026-02-04T00:00:00Z"),
    })).toBe(false)
  })

  it("skips when due date is far away", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    expect(shouldSendUpcomingReminder(now, {
      status: "active", nextBillingDate: due, lastReminderType: null, lastReminderAt: null,
    })).toBe(false)
  })
})

describe("shouldSendOverdueReminder", () => {
  it("sends once after the due date when status is overdue", () => {
    const now = new Date("2026-02-11T00:00:00Z")
    expect(shouldSendOverdueReminder(now, {
      status: "overdue", nextBillingDate: due, lastReminderType: null, lastReminderAt: null,
    })).toBe(true)
  })

  it("does not send a second overdue mail", () => {
    const now = new Date("2026-02-12T00:00:00Z")
    expect(shouldSendOverdueReminder(now, {
      status: "overdue",
      nextBillingDate: due,
      lastReminderType: "overdue",
      lastReminderAt: new Date("2026-02-11T00:00:00Z"),
    })).toBe(false)
  })
})
