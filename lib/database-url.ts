const HOSTINGER_MYSQL_HOST = "auth-db1193.hstgr.io"

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Node.js on Hostinger resolves localhost to IPv6 ::1, which MySQL rejects. */
function rewriteHost(host: string, production: boolean): string {
  if (production && host === "localhost") return "127.0.0.1"
  return host
}

function composeFromSplitVars(): string | undefined {
  const host = process.env.DB_HOST ?? process.env.MYSQL_HOST
  const user = process.env.DB_USER ?? process.env.MYSQL_USER
  const password = process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD ?? ""
  const database = process.env.DB_NAME ?? process.env.MYSQL_DATABASE
  const port = process.env.DB_PORT ?? process.env.MYSQL_PORT ?? "3306"
  if (!host || !user || !database) return undefined
  const safeHost = rewriteHost(host, process.env.NODE_ENV === "production")
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${safeHost}:${port}/${database}`
}

export function parseMysqlUrl(raw: string): {
  user: string
  password: string
  host: string
  port: string
  database: string
  query: string
} | null {
  const parsed = raw.trim().match(/^mysql:\/\/([^:/]+):(.+)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/)
  if (!parsed) return null
  return {
    user: decodeComponent(parsed[1]),
    password: decodeComponent(parsed[2]),
    host: parsed[3],
    port: parsed[4],
    database: parsed[5],
    query: parsed[6] ?? "",
  }
}

export function buildMysqlUrl(parts: {
  user: string
  password: string
  host: string
  port: string
  database: string
  query?: string
}): string {
  return `mysql://${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}@${parts.host}:${parts.port}/${parts.database}${parts.query ?? ""}`
}

/** Encodes @/$ in the password and uses 127.0.0.1 instead of localhost in production. */
export function normalizeDatabaseUrl(
  raw: string,
  opts?: { production?: boolean },
): string {
  const trimmed = raw.trim()
  const production = opts?.production ?? process.env.NODE_ENV === "production"
  const parsed = parseMysqlUrl(trimmed)
  if (!parsed) {
    return trimmed.replace("@localhost", `@${rewriteHost("localhost", production)}`)
  }
  parsed.host = rewriteHost(parsed.host, production)
  return buildMysqlUrl(parsed)
}

export function withDatabaseHost(raw: string, host: string): string {
  const parsed = parseMysqlUrl(normalizeDatabaseUrl(raw, { production: false }))
  if (!parsed) return raw
  parsed.host = host
  return buildMysqlUrl(parsed)
}

export function databaseHostOf(raw: string | undefined): string | null {
  if (!raw) return null
  return parseMysqlUrl(normalizeDatabaseUrl(raw, { production: false }))?.host ?? null
}

export function candidateDatabaseUrls(raw: string): { label: string; url: string }[] {
  const base = normalizeDatabaseUrl(raw, { production: true })
  const hosts = ["127.0.0.1", "localhost", HOSTINGER_MYSQL_HOST]
  const seen = new Set<string>()
  const out: { label: string; url: string }[] = []
  for (const host of hosts) {
    const url = withDatabaseHost(base, host)
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ label: host, url })
  }
  return out
}

export function sanitizeDbMessage(message: string): string {
  return message
    .replace(/mysql:\/\/[^@\s]+@/g, "mysql://***@")
    .replace(/password=[^&\s]+/gi, "password=***")
}

export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function applyDatabaseUrlFromEnv(): void {
  if (!process.env.DATABASE_URL) {
    const composed = composeFromSplitVars()
    if (composed) process.env.DATABASE_URL = composed
  }
  if (!process.env.DATABASE_URL) return
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
}
