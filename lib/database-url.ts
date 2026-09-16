const HOSTINGER_MYSQL_HOST = "auth-db1193.hstgr.io"

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function rewriteHost(host: string, production: boolean): string {
  if (production && (host === "localhost" || host === "127.0.0.1")) {
    return HOSTINGER_MYSQL_HOST
  }
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

/** Encodes @/$ in the password and uses the Hostinger MySQL hostname in production. */
export function normalizeDatabaseUrl(
  raw: string,
  opts?: { production?: boolean },
): string {
  const trimmed = raw.trim()
  const production = opts?.production ?? process.env.NODE_ENV === "production"
  const parsed = trimmed.match(/^mysql:\/\/([^:/]+):(.+)@([^:/]+):(\d+)\/([^?]+)(\?.*)?$/)
  if (!parsed) {
    return trimmed.replace("@localhost", `@${rewriteHost("localhost", production)}`)
  }
  const user = decodeComponent(parsed[1])
  const password = decodeComponent(parsed[2])
  const host = rewriteHost(parsed[3], production)
  const port = parsed[4]
  const database = parsed[5]
  const query = parsed[6] ?? ""
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${query}`
}

export function applyDatabaseUrlFromEnv(): void {
  if (!process.env.DATABASE_URL) {
    const composed = composeFromSplitVars()
    if (composed) process.env.DATABASE_URL = composed
  }
  if (!process.env.DATABASE_URL) return
  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
}
