import { describe, expect, it } from "vitest"
import { passwordSchema } from "@/validators/password"
import { resetPasswordFormSchema } from "@/validators/auth"

describe("passwordSchema", () => {
  it("rejects passwords shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false)
  })

  it("accepts 8 or more characters", () => {
    expect(passwordSchema.safeParse("senha123").success).toBe(true)
  })
})

describe("resetPasswordFormSchema", () => {
  it("rejects when confirmation does not match", () => {
    expect(resetPasswordFormSchema.safeParse({ password: "senha123", confirm: "outra123" }).success).toBe(false)
  })

  it("accepts matching passwords", () => {
    expect(resetPasswordFormSchema.safeParse({ password: "senha123", confirm: "senha123" }).success).toBe(true)
  })
})
