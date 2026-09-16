import { describe, expect, it } from "vitest"
import {
  buildAccessWhatsAppUrl,
  buildContactWhatsAppUrl,
  formatWhatsAppPhone,
  normalizeWhatsAppPhone,
  parseOptionalWhatsAppPhone,
} from "@/lib/whatsapp"

describe("normalizeWhatsAppPhone", () => {
  it("adds Brazil country code to local numbers", () => {
    expect(normalizeWhatsAppPhone("11 99999-9999")).toBe("5511999999999")
    expect(normalizeWhatsAppPhone("(11) 3333-3333")).toBe("551133333333")
  })

  it("keeps numbers that already include 55", () => {
    expect(normalizeWhatsAppPhone("+55 11 99999-9999")).toBe("5511999999999")
  })

  it("rejects empty or too short values", () => {
    expect(normalizeWhatsAppPhone("")).toBeNull()
    expect(normalizeWhatsAppPhone("119999")).toBeNull()
  })
})

describe("parseOptionalWhatsAppPhone", () => {
  it("treats empty as null", () => {
    expect(parseOptionalWhatsAppPhone("")).toEqual({ ok: true, value: null })
    expect(parseOptionalWhatsAppPhone("   ")).toEqual({ ok: true, value: null })
    expect(parseOptionalWhatsAppPhone(null)).toEqual({ ok: true, value: null })
  })

  it("normalizes a valid number", () => {
    expect(parseOptionalWhatsAppPhone("11 98888-7777")).toEqual({ ok: true, value: "5511988887777" })
  })

  it("rejects invalid numbers", () => {
    expect(parseOptionalWhatsAppPhone("123")).toEqual({
      ok: false,
      error: "WhatsApp inválido. Use DDD, ex: 11 99999-9999",
    })
  })
})

describe("formatWhatsAppPhone", () => {
  it("formats Brazilian mobiles", () => {
    expect(formatWhatsAppPhone("5511999999999")).toBe("(11) 99999-9999")
  })
})

describe("buildAccessWhatsAppUrl", () => {
  it("builds a wa.me link with encoded access data", () => {
    const url = buildAccessWhatsAppUrl({
      phone: "11988887777",
      name: "Maria Silva",
      email: "maria@example.com",
      password: "segredo",
      loginUrl: "http://localhost:3000/login",
    })
    expect(url).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/)
    const text = decodeURIComponent(url!.split("text=")[1])
    expect(text).toContain("Olá, Maria!")
    expect(text).toContain("E-mail: maria@example.com")
    expect(text).toContain("Senha: segredo")
    expect(text).toContain("http://localhost:3000/login")
  })

  it("returns null for an invalid phone", () => {
    expect(buildAccessWhatsAppUrl({
      phone: "123",
      name: "A",
      email: "a@a.com",
      password: "x",
      loginUrl: "http://localhost:3000/login",
    })).toBeNull()
  })
})

describe("buildContactWhatsAppUrl", () => {
  it("omits the password", () => {
    const url = buildContactWhatsAppUrl({
      phone: "11988887777",
      name: "Maria",
      email: "maria@example.com",
      loginUrl: "http://localhost:3000/login",
    })
    const text = decodeURIComponent(url!.split("text=")[1])
    expect(text).toContain("E-mail: maria@example.com")
    expect(text).not.toContain("Senha:")
  })
})
