export function normalizeWhatsAppPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "")
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (digits.length < 12 || digits.length > 15) return null
  return digits
}

/** Aceita vazio (grava null) ou um número com DDD. */
export function parseOptionalWhatsAppPhone(raw: string | undefined | null):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: null }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  const value = normalizeWhatsAppPhone(trimmed)
  if (!value) return { ok: false, error: "WhatsApp inválido. Use DDD, ex: 11 99999-9999" }
  return { ok: true, value }
}

export function formatWhatsAppPhone(raw: string | null | undefined): string {
  if (!raw) return ""
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return raw
}

export function buildWhatsAppUrl(phone: string, text?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone)
  if (!normalized) return null
  if (!text) return `https://wa.me/${normalized}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
}

function greetName(name: string) {
  const firstName = name.trim().split(/\s+/)[0]
  return firstName ? `Olá, ${firstName}!` : "Olá!"
}

export function buildAccessWhatsAppUrl(opts: {
  phone: string
  name: string
  email: string
  password: string
  loginUrl: string
}): string | null {
  const text = `${greetName(opts.name)} Sua conta no GEFlix foi criada.

Acesse: ${opts.loginUrl}
E-mail: ${opts.email}
Senha: ${opts.password}

Recomendamos alterar a senha depois do primeiro acesso.`
  return buildWhatsAppUrl(opts.phone, text)
}

export function buildContactWhatsAppUrl(opts: {
  phone: string
  name: string
  email: string
  loginUrl: string
}): string | null {
  const text = `${greetName(opts.name)} Seu acesso ao GEFlix:

Acesse: ${opts.loginUrl}
E-mail: ${opts.email}`
  return buildWhatsAppUrl(opts.phone, text)
}
