export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return
  const { warnIfTrustProxyUnset } = await import("./lib/rate-limit")
  warnIfTrustProxyUnset()
}
