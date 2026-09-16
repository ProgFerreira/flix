export const TERMS_VERSION = "2026-09-15"

export const CONSENTIMENTO_TIPOS = ["termos_uso", "politica_privacidade"] as const

export type ConsentimentoTipo = (typeof CONSENTIMENTO_TIPOS)[number]

export function anonymizedEmail(userId: number) {
  return `removido_${userId}@anonimo.local`
}

export const ANON_NAME = "Usuário Removido"
