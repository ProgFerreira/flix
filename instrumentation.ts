export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return
  const { pickWorkingDatabaseUrl } = await import("./lib/pick-database")
  const probes = await pickWorkingDatabaseUrl()
  const ok = probes.find((p) => p.ok)
  if (ok) console.info(`[db] conectado em ${ok.host}`)
  else console.error("[db] nenhum host MySQL respondeu", probes)
  const { warnIfTrustProxyUnset } = await import("./lib/rate-limit")
  warnIfTrustProxyUnset()
}
