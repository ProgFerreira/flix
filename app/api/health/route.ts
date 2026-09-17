import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { lastDatabaseProbes, pickedDatabaseHost } from "@/lib/pick-database"
import { lastMigrateResult } from "@/lib/migrate-deploy"
import { databaseHostOf, sanitizeDbMessage } from "@/lib/database-url"

// DIAGNÓSTICO TEMPORÁRIO (remover depois de corrigir o mismatch de case das
// tabelas em produção): renomeia as 22 tabelas de minúsculo pro nome exato
// que o Prisma Client espera, sem perder dados. Protegido pelo CRON_SECRET
// que já existe no ambiente.
const TABLE_RENAMES: [string, string][] = [
  ["user", "User"],
  ["emailverificationtoken", "EmailVerificationToken"],
  ["passwordresettoken", "PasswordResetToken"],
  ["favorite", "Favorite"],
  ["watchprogress", "WatchProgress"],
  ["subscription", "Subscription"],
  ["planchangerequest", "PlanChangeRequest"],
  ["planpayment", "PlanPayment"],
  ["consentimentolgpd", "ConsentimentoLgpd"],
  ["adminauditlog", "AdminAuditLog"],
  ["category", "Category"],
  ["video", "Video"],
  ["videocategory", "VideoCategory"],
  ["videoshare", "VideoShare"],
  ["videoaccessgrant", "VideoAccessGrant"],
  ["collection", "Collection"],
  ["collectionmember", "CollectionMember"],
  ["collectionvideo", "CollectionVideo"],
  ["course", "Course"],
  ["coursemodule", "CourseModule"],
  ["courselesson", "CourseLesson"],
  ["ratelimitbucket", "RateLimitBucket"],
]

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  const existing = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()
  `
  const existingNames = new Set(existing.map((t) => t.table_name))
  const pending = TABLE_RENAMES.filter(([from]) => existingNames.has(from))
  if (pending.length === 0) {
    return Response.json({ renamed: [], message: "nada pra renomear" })
  }
  const clause = pending.map(([from, to]) => `\`${from}\` TO \`${to}\``).join(", ")
  await prisma.$executeRawUnsafe(`RENAME TABLE ${clause}`)
  return Response.json({ renamed: pending })
}

export async function GET() {
  const checks: {
    status: string
    timestamp: string
    database: string
    uptime: number
    hasDatabaseUrl: boolean
    dbHost: string | null
    dbCode?: string
    dbMessage?: string
    probes: ReturnType<typeof lastDatabaseProbes>
    migrate: ReturnType<typeof lastMigrateResult> | null
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "ok",
    uptime: process.uptime(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    dbHost: pickedDatabaseHost() ?? databaseHostOf(process.env.DATABASE_URL),
    probes: lastDatabaseProbes(),
    migrate: lastMigrateResult() ?? null,
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    const e = err as { code?: string; message?: string }
    checks.database = "error"
    checks.status = "degraded"
    checks.dbCode = typeof e.code === "string" ? e.code : undefined
    checks.dbMessage = sanitizeDbMessage(typeof e.message === "string" ? e.message : "erro de banco")
    return Response.json(checks, { status: 503 })
  }

  return Response.json(checks)
}
