import { prisma } from "@/lib/prisma"

export async function GET() {
  const checks = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "ok",
    uptime: process.uptime(),
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
