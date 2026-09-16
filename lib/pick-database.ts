import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import {
  applyDatabaseUrlFromEnv,
  candidateDatabaseUrls,
  databaseHostOf,
  parseEnvText,
  sanitizeDbMessage,
} from "@/lib/database-url"

export type DbProbe = {
  host: string
  ok: boolean
  code?: string
  message?: string
}

const g = globalThis as unknown as {
  __flixDbProbes?: DbProbe[]
  __flixDbUrl?: string
}

function loadProductionEnvFile() {
  if (process.env.NODE_ENV !== "production") return
  const file = path.join(process.cwd(), ".env.production")
  if (!existsSync(file)) return
  const parsed = parseEnvText(readFileSync(file, "utf8"))
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value
  }
}

function prismaError(err: unknown): { code?: string; message: string } {
  const e = err as { code?: string; message?: string }
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    message: sanitizeDbMessage(typeof e.message === "string" ? e.message : "erro de banco"),
  }
}

export function lastDatabaseProbes(): DbProbe[] {
  return g.__flixDbProbes ?? []
}

export function pickedDatabaseHost(): string | null {
  return databaseHostOf(g.__flixDbUrl ?? process.env.DATABASE_URL)
}

export async function pickWorkingDatabaseUrl(): Promise<DbProbe[]> {
  loadProductionEnvFile()
  applyDatabaseUrlFromEnv()
  const raw = process.env.DATABASE_URL
  if (!raw) {
    const probes: DbProbe[] = [{ host: "(ausente)", ok: false, message: "DATABASE_URL não definida" }]
    g.__flixDbProbes = probes
    return probes
  }

  const probes: DbProbe[] = []
  for (const candidate of candidateDatabaseUrls(raw)) {
    const client = new PrismaClient({ datasources: { db: { url: candidate.url } } })
    try {
      await client.$queryRaw`SELECT 1`
      probes.push({ host: candidate.label, ok: true })
      g.__flixDbUrl = candidate.url
      process.env.DATABASE_URL = candidate.url
      await client.$disconnect()
      g.__flixDbProbes = probes
      return probes
    } catch (err) {
      const info = prismaError(err)
      probes.push({ host: candidate.label, ok: false, code: info.code, message: info.message })
      await client.$disconnect().catch(() => undefined)
    }
  }

  g.__flixDbProbes = probes
  return probes
}
