import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import {
  callerOrigin,
  expectedOrigin,
  isCsrfExempt,
  rejectCrossOriginMutation,
} from "@/lib/csrf"

const SITE = "http://localhost:3000"

function req(
  path: string,
  init?: {
    method?: string
    origin?: string | null
    referer?: string
    url?: string
    host?: string
    forwardedHost?: string
    forwardedProto?: string
  },
) {
  const headers = new Headers()
  if (init?.origin !== undefined && init.origin !== null) headers.set("origin", init.origin)
  if (init?.referer) headers.set("referer", init.referer)
  if (init?.host) headers.set("host", init.host)
  if (init?.forwardedHost) headers.set("x-forwarded-host", init.forwardedHost)
  if (init?.forwardedProto) headers.set("x-forwarded-proto", init.forwardedProto)
  const base = init?.url ?? SITE
  return new NextRequest(`${base}${path}`, { method: init?.method ?? "GET", headers })
}

describe("isCsrfExempt", () => {
  it("skips safe methods", () => {
    expect(isCsrfExempt("/api/videos", "GET")).toBe(true)
    expect(isCsrfExempt("/api/videos", "HEAD")).toBe(true)
    expect(isCsrfExempt("/api/videos", "OPTIONS")).toBe(true)
  })

  it("skips native NextAuth endpoints, including nested callback paths", () => {
    expect(isCsrfExempt("/api/auth/callback/credentials", "POST")).toBe(true)
    expect(isCsrfExempt("/api/auth/signout", "POST")).toBe(true)
    expect(isCsrfExempt("/api/auth/signin", "POST")).toBe(true)
    expect(isCsrfExempt("/api/auth/session", "POST")).toBe(true)
    expect(isCsrfExempt("/api/auth/csrf", "GET")).toBe(true)
  })

  it("does not skip custom auth routes that are ours, not NextAuth", () => {
    expect(isCsrfExempt("/api/auth/setup", "POST")).toBe(false)
    expect(isCsrfExempt("/api/auth/forgot-password", "POST")).toBe(false)
    expect(isCsrfExempt("/api/auth/reset-password", "POST")).toBe(false)
    expect(isCsrfExempt("/api/auth/verify-email", "POST")).toBe(false)
    expect(isCsrfExempt("/api/auth/resend-verification", "POST")).toBe(false)
  })

  it("skips the cron job (Bearer CRON_SECRET, no browser Origin)", () => {
    expect(isCsrfExempt("/api/cron/billing", "POST")).toBe(true)
  })

  it("checks mutating business routes", () => {
    expect(isCsrfExempt("/api/videos", "POST")).toBe(false)
    expect(isCsrfExempt("/api/catalog/1", "PATCH")).toBe(false)
    expect(isCsrfExempt("/api/admin/users/2", "DELETE")).toBe(false)
    expect(isCsrfExempt("/api/catalog/1/grants", "PUT")).toBe(false)
  })
})

describe("expectedOrigin / callerOrigin", () => {
  const original = process.env.NEXTAUTH_URL

  beforeEach(() => {
    process.env.NEXTAUTH_URL = SITE
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = original
  })

  it("reads the canonical origin from NEXTAUTH_URL, ignoring a trailing path", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000/flix"
    expect(expectedOrigin(req("/api/videos"))).toBe(SITE)
  })

  it("falls back to the request URL when NEXTAUTH_URL is unset", () => {
    delete process.env.NEXTAUTH_URL
    expect(expectedOrigin(req("/api/videos"))).toBe(SITE)
  })

  it("prefers Origin over Referer", () => {
    const r = req("/api/videos", {
      method: "POST",
      origin: SITE,
      referer: "https://evil.example/page",
    })
    expect(callerOrigin(r)).toBe(SITE)
  })

  it("uses Referer origin when Origin is absent", () => {
    const r = req("/api/videos", { method: "POST", referer: `${SITE}/conta` })
    expect(callerOrigin(r)).toBe(SITE)
  })

  it("rejects the opaque Origin null", () => {
    const r = req("/api/videos", { method: "POST", origin: "null" })
    expect(callerOrigin(r)).toBeNull()
  })
})

describe("rejectCrossOriginMutation", () => {
  const original = process.env.NEXTAUTH_URL
  const originalTrustProxy = process.env.TRUST_PROXY

  beforeEach(() => {
    process.env.NEXTAUTH_URL = SITE
    process.env.TRUST_PROXY = "false"
  })

  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = original
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = originalTrustProxy
  })

  it("lets GET through without Origin", async () => {
    expect(rejectCrossOriginMutation(req("/api/videos"))).toBeNull()
  })

  it("does not apply outside /api", () => {
    expect(rejectCrossOriginMutation(req("/admin/clientes", { method: "POST" }))).toBeNull()
  })

  it("lets a same-origin POST through", () => {
    expect(rejectCrossOriginMutation(req("/api/videos", { method: "POST", origin: SITE }))).toBeNull()
  })

  it("lets a same-origin POST through using only Referer", () => {
    expect(
      rejectCrossOriginMutation(req("/api/videos", { method: "POST", referer: `${SITE}/` })),
    ).toBeNull()
  })

  it("rejects a mutating request with no Origin or Referer", async () => {
    const res = rejectCrossOriginMutation(req("/api/videos", { method: "POST" }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    expect((await res!.json()).error).toMatch(/origem/i)
  })

  it("rejects a cross-origin POST", async () => {
    const res = rejectCrossOriginMutation(
      req("/api/admin/users", { method: "POST", origin: "https://evil.example" }),
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it("rejects http vs https mismatch", async () => {
    const res = rejectCrossOriginMutation(
      req("/api/catalog", { method: "POST", origin: "https://localhost:3000" }),
    )
    expect(res!.status).toBe(403)
  })

  it("still protects custom auth routes that are not NextAuth", async () => {
    const res = rejectCrossOriginMutation(
      req("/api/auth/setup", { method: "POST", origin: "https://evil.example" }),
    )
    expect(res!.status).toBe(403)
  })

  it("does not interfere with NextAuth's own CSRF", () => {
    expect(
      rejectCrossOriginMutation(req("/api/auth/callback/credentials", { method: "POST" })),
    ).toBeNull()
  })

  it("does not block the cron job without a browser Origin", () => {
    expect(rejectCrossOriginMutation(req("/api/cron/billing", { method: "POST" }))).toBeNull()
  })

  it("lets a POST through when Origin matches the request host even if NEXTAUTH_URL has another port", () => {
    const res = rejectCrossOriginMutation(
      req("/api/videos", {
        method: "POST",
        url: "http://localhost:3003",
        origin: "http://localhost:3003",
      }),
    )
    expect(res).toBeNull()
  })

  it("lets a POST through when Origin matches the LAN host the user opened", () => {
    const lan = "http://192.168.0.10:3003"
    const res = rejectCrossOriginMutation(
      req("/api/videos", { method: "POST", url: lan, origin: lan }),
    )
    expect(res).toBeNull()
  })

  it("still rejects a cross-origin POST even when the request host is the app", () => {
    const res = rejectCrossOriginMutation(
      req("/api/videos", {
        method: "POST",
        url: "http://localhost:3003",
        origin: "https://evil.example",
      }),
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it("ignores a spoofed forwarded host when TRUST_PROXY is off", () => {
    process.env.TRUST_PROXY = "false"
    const res = rejectCrossOriginMutation(
      req("/api/videos", {
        method: "POST",
        url: "http://localhost:3003",
        origin: "https://evil.example",
        forwardedHost: "evil.example",
        forwardedProto: "https",
      }),
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it("lets a POST through when Origin matches the forwarded host and TRUST_PROXY is on", () => {
    process.env.TRUST_PROXY = "true"
    const res = rejectCrossOriginMutation(
      req("/api/videos", {
        method: "POST",
        url: "http://127.0.0.1:3003",
        origin: "https://geflix.app",
        forwardedHost: "geflix.app",
        forwardedProto: "https",
      }),
    )
    expect(res).toBeNull()
  })
})
