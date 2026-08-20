import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("sendPasswordResetEmail", () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    delete process.env.RESEND_API_KEY
    vi.resetModules()
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  it("resolves without throwing when RESEND_API_KEY is missing (dev fallback)", async () => {
    const { sendPasswordResetEmail } = await import("@/lib/email")
    await expect(sendPasswordResetEmail("user@example.com", "https://example.com/reset?token=x")).resolves.toBeUndefined()
  })
})
