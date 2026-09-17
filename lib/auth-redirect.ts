/** Only allow local destinations; reject protocol-relative and escaped URLs. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s\x00-\x1f]/.test(value)) return "/"
  try {
    const url = new URL(value, "https://flix.local")
    if (url.origin !== "https://flix.local" || url.pathname === "/login") return "/"
    return url.pathname + url.search + url.hash
  } catch { return "/" }
}

export function loginHref(returnTo = "/", register = false): string {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo) })
  if (register) params.set("mode", "register")
  return `/login?${params}`
}

/** Post-logout URL. Query string avoids a CDN hit on the bare `/login` cache. */
export function logoutHref(): string {
  return loginHref("/")
}
