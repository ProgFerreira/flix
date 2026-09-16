import { PrismaClient } from "@prisma/client"
import { applyDatabaseUrlFromEnv } from "@/lib/database-url"

applyDatabaseUrlFromEnv()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrisma() {
  const url = process.env.DATABASE_URL
  return url
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient()
}

/** Client antigo (antes do generate) não tem modelos novos — recria em vez de reutilizar. */
function isUsable(client: PrismaClient) {
  const c = client as unknown as { planChangeRequest?: unknown; consentimentoLgpd?: unknown; rateLimitBucket?: unknown }
  return typeof c.planChangeRequest !== "undefined"
    && typeof c.consentimentoLgpd !== "undefined"
    && typeof c.rateLimitBucket !== "undefined"
}

export const prisma = globalForPrisma.prisma && isUsable(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
