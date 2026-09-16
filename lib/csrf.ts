import { NextResponse } from "next/server"

/**
 * CSRF nas rotas de negócio (`/api/*`).
 *
 * Decisão: a API é JSON same-origin, sem CORS liberado, e o cookie de sessão
 * do NextAuth já vai com SameSite=Lax — um POST cross-site típico nem leva o
 * cookie. Ainda assim isso era um efeito colateral do padrão, não uma regra
 * nossa. A defesa extra aqui é explícita: POST/PUT/PATCH/DELETE em `/api/*`
 * só passam se `Origin` (ou, na falta dele, a origem do `Referer`) for uma
 * destas:
 *   - a origem de `NEXTAUTH_URL`
 *   - a origem do próprio pedido (`Host`, ou `X-Forwarded-Host` quando
 *     `TRUST_PROXY=true`)
 *
 * A segunda regra cobre o caso real deste app: `next dev -H 0.0.0.0 -p 3003`
 * (localhost vs 127.0.0.1 vs IP da LAN, e `NEXTAUTH_URL` com porta antiga).
 * Um POST de `evil.example` continua recusado: o `Host` do alvo não bate.
 *
 * O NextAuth já tem CSRF nativo nos endpoints dele (signin/callback/signout).
 * O cron (`/api/cron/*`) autentica com Bearer `CRON_SECRET` e não vem de um
 * navegador — fica de fora. GET/HEAD/OPTIONS não mudam estado e não exigem
 * Origin.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const NEXT_AUTH_NATIVE =
  /^\/api\/auth\/(session|csrf|providers|signin|signout|callback|_log|error)(\/|$)/

function originOf(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null
  const first = value.split(",")[0]?.trim()
  return first || null
}

function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true"
}

export function expectedOrigin(req: Request): string | null {
  const fromEnv = process.env.NEXTAUTH_URL?.trim()
  if (fromEnv) return originOf(fromEnv)
  return originOf(req.url)
}

export function requestOrigin(req: Request): string | null {
  if (trustProxy()) {
    const forwardedHost = firstHeaderValue(req.headers.get("x-forwarded-host"))
    if (forwardedHost) {
      const proto = firstHeaderValue(req.headers.get("x-forwarded-proto"))
      const scheme = proto === "https" ? "https" : "http"
      return originOf(`${scheme}://${forwardedHost}`)
    }
  }

  const host = firstHeaderValue(req.headers.get("host"))
  if (host) {
    const fromUrl = originOf(req.url)
    const scheme = fromUrl?.startsWith("https://") ? "https" : "http"
    return originOf(`${scheme}://${host}`)
  }

  return originOf(req.url)
}

export function callerOrigin(req: Request): string | null {
  const origin = req.headers.get("origin")
  if (origin) {
    if (origin === "null") return null
    return originOf(origin)
  }
  const referer = req.headers.get("referer")
  if (!referer) return null
  return originOf(referer)
}

export function isCsrfExempt(pathname: string, method: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true
  if (NEXT_AUTH_NATIVE.test(pathname)) return true
  if (pathname === "/api/cron" || pathname.startsWith("/api/cron/")) return true
  return false
}

export function rejectCrossOriginMutation(req: Request): NextResponse | null {
  const pathname = new URL(req.url).pathname
  if (!pathname.startsWith("/api/") && pathname !== "/api") return null
  if (isCsrfExempt(pathname, req.method)) return null

  const caller = callerOrigin(req)
  if (!caller) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403 })
  }

  const allowed = new Set<string>()
  const fromEnv = expectedOrigin(req)
  if (fromEnv) allowed.add(fromEnv)
  const fromRequest = requestOrigin(req)
  if (fromRequest) allowed.add(fromRequest)

  if (allowed.has(caller)) return null

  return NextResponse.json({ error: "Origem não permitida" }, { status: 403 })
}
