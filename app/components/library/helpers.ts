export function parseDurationToSeconds(d: string | null | undefined): number {
  if (!d) return 0
  const ms = d.trim().match(/^(\d+)m(\d+)s$/)
  if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2])
  const p = d.split(":").map(Number)
  if (p.length === 2) return (p[0] ?? 0) * 60 + (p[1] ?? 0)
  if (p.length === 3) return (p[0] ?? 0) * 3600 + (p[1] ?? 0) * 60 + (p[2] ?? 0)
  return 0
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

export function avatar(user: { email: string; name?: string | null }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}
