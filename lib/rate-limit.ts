type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 5 * 60 * 1000

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number }

export function applyRateLimitHit(
  bucket: Bucket | undefined,
  now: number,
  limit: number,
  windowMs: number,
): { bucket: Bucket; allowed: boolean; retryAfterMs: number } {
  if (!bucket || now >= bucket.resetAt) {
    return { bucket: { count: 1, resetAt: now + windowMs }, allowed: true, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { bucket, allowed: false, retryAfterMs: bucket.resetAt - now }
  }
  return { bucket: { count: bucket.count + 1, resetAt: bucket.resetAt }, allowed: true, retryAfterMs: 0 }
}

function hitMemory(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  sweepExpired(now)
  const next = applyRateLimitHit(buckets.get(key), now, limit, windowMs)
  buckets.set(key, next.bucket)
  return { allowed: next.allowed, retryAfterMs: next.retryAfterMs }
}

async function hitDatabase(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
  const { prisma } = await import("@/lib/prisma")
  // INSERT creates the row if needed and locks an existing row until commit.
  // All reads/increments occur under the same transaction lock.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$executeRaw`INSERT INTO RateLimitBucket (chave, count, resetAt)
          VALUES (${key}, 0, ${new Date(now + windowMs)})
          ON DUPLICATE KEY UPDATE chave = VALUES(chave)`
        const existing = await tx.rateLimitBucket.findUniqueOrThrow({ where: { chave: key } })
        const next = applyRateLimitHit({ count: existing.count, resetAt: existing.resetAt.getTime() }, now, limit, windowMs)
        await tx.rateLimitBucket.update({ where: { chave: key }, data: { count: next.bucket.count, resetAt: new Date(next.bucket.resetAt) } })
        return { allowed: next.allowed, retryAfterMs: next.retryAfterMs }
      }, { maxWait: 10000, timeout: 10000 })
    } catch (error) {
      if (attempt < 2 && error && typeof error === "object" && "code" in error && error.code === "P2034") continue
      throw error
    }
  }
}

/**
 * Janela fixa: até `limit` chamadas por `windowMs` para a mesma `key`.
 * Persiste no MySQL (sobrevive a restart e a 2 instâncias). Se o banco
 * não tiver a tabela ainda, cai no Map em memória.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
  try {
    const { prisma } = await import("@/lib/prisma")
    if (typeof prisma.rateLimitBucket?.findUnique === "function") {
      return await hitDatabase(key, limit, windowMs, now)
    }
  } catch {
    // migration ainda não aplicada, ou MySQL fora — não derruba login/cadastro
  }
  return hitMemory(key, limit, windowMs, now)
}

/** Só pra teste — não usar em código de produto. */
export function _resetRateLimitStore() {
  buckets.clear()
}

function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true"
}

export function warnIfTrustProxyUnset(): void {
  const raw = process.env.TRUST_PROXY?.trim()
  if (!raw) {
    console.warn(
      '[rate-limit] TRUST_PROXY não está definida. Sem ela, x-forwarded-for é ignorado e o limite de login/cadastro cai no IP fixo "unknown" (um único visitante pode bloquear todo mundo por 15 min). Em produção atrás de Apache/WAMP/nginx/CDN, defina TRUST_PROXY=true. Só deixe false se o Node receber o pedido direto, sem proxy.',
    )
    return
  }
  if (raw !== "true" && raw !== "false") {
    console.warn(
      `[rate-limit] TRUST_PROXY="${raw}" é inválida (use "true" ou "false"). Cabeçalhos de proxy só são honrados com TRUST_PROXY=true.`,
    )
  }
}

export function getClientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (name: string): string | undefined => {
    if (!headers) return undefined
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    const v = headers[name] ?? headers[name.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }

  if (trustProxy()) {
    const forwarded = get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0].trim()
    const real = get("x-real-ip")
    if (real) return real
  }

  return "unknown"
}
