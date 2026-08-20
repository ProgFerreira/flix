import crypto from "crypto"

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/** Token cru vai por e-mail; só o hash é gravado no banco. */
export function generateResetToken(now = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex")
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  }
}

export type ResetTokenRecord = { expiresAt: Date; usedAt: Date | null }

/** Token só é válido se ainda não foi usado e ainda não venceu. */
export function isResetTokenValid(record: ResetTokenRecord, now = new Date()): boolean {
  return record.usedAt === null && now <= record.expiresAt
}
