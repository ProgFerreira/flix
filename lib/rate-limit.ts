// Limiter em memória — funciona pra uma instância só. Se um dia o app rodar
// em mais de um servidor ao mesmo tempo, cada instância teria sua própria
// contagem e o limite efetivo seria multiplicado; nesse cenário precisaria
// de um store compartilhado (Redis/Upstash) em vez deste Map.
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Evita que o Map cresça pra sempre com chaves velhas (IP+email únicos por
// tentativa) — varre de vez em quando em vez de a cada chamada.
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

/**
 * Janela fixa simples: até `limit` chamadas por `windowMs` para a mesma
 * `key`. Passe uma chave que combine o que faz sentido pro caso (IP, IP+email,
 * etc) — chaves diferentes têm contadores independentes.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  sweepExpired(now)

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now }
  }

  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

/** Só pra teste — não usar em código de produto. */
export function _resetRateLimitStore() {
  buckets.clear()
}

/**
 * IP de quem fez a requisição, olhando os headers de proxy usuais primeiro
 * (o Next.js roda atrás de um proxy/CDN na maioria dos deploys). Sem nenhum
 * header, cai num valor fixo — nesse caso o rate limit vira "global" em vez
 * de por IP, o que ainda é melhor que nenhum limite.
 */
export function getClientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  const get = (name: string): string | undefined => {
    if (!headers) return undefined
    if (headers instanceof Headers) return headers.get(name) ?? undefined
    const v = headers[name] ?? headers[name.toLowerCase()]
    return Array.isArray(v) ? v[0] : v
  }

  const forwarded = get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()

  const real = get("x-real-ip")
  if (real) return real

  return "unknown"
}
