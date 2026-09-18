import { prisma } from "@/lib/prisma"

export async function GET() {
  const checks: {
    status: string
    timestamp: string
    database: string
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "ok",
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    checks.database = "error"
    checks.status = "degraded"
    return Response.json(checks, { status: 503 })
  }

  return Response.json(checks)
}
