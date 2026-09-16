import { prisma } from "@/lib/prisma"
import { lastDatabaseProbes, pickedDatabaseHost } from "@/lib/pick-database"
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
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "ok",
    uptime: process.uptime(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    dbHost: pickedDatabaseHost() ?? databaseHostOf(process.env.DATABASE_URL),
    probes: lastDatabaseProbes(),
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
