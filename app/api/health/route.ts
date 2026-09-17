import { prisma } from "@/lib/prisma"
import { lastDatabaseProbes, pickedDatabaseHost } from "@/lib/pick-database"
import { lastMigrateResult } from "@/lib/migrate-deploy"
import { databaseHostOf, sanitizeDbMessage } from "@/lib/database-url"

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
    // Diagnóstico temporário: migrate deploy diz "no pending migrations" mas
    // o cadastro dá P2021 (tabela ausente) — precisa ver o que existe de fato.
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()
    `
    ;(checks as unknown as Record<string, unknown>).tables = tables.map((t) => t.table_name)
    const lowerCaseSetting = await prisma.$queryRaw<{ Variable_name: string; Value: string }[]>`
      SHOW VARIABLES LIKE 'lower_case_table_names'
    `
    ;(checks as unknown as Record<string, unknown>).lowerCaseTableNames = lowerCaseSetting[0]?.Value
    const userCount = await prisma.$queryRawUnsafe<{ c: bigint }[]>("SELECT COUNT(*) as c FROM `user`")
    ;(checks as unknown as Record<string, unknown>).userCount = Number(userCount[0]?.c ?? 0)
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
