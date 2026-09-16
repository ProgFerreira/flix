import { extractYouTubeId } from "@/lib/utils"

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
])

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/

/**
 * Só aceita URL de playlist/página do YouTube. Qualquer outro host (incluindo
 * localhost, IPs e esquemas que não sejam http/https) é recusado — a rota de
 * import faz fetch no servidor, então uma URL arbitrária seria SSRF.
 */
export function isAllowedYouTubeUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }

  if (u.protocol !== "https:" && u.protocol !== "http:") return false

  const host = u.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false
  if (IPV4.test(host) || host.includes(":")) return false

  return YOUTUBE_HOSTS.has(host)
}

/** Host do YouTube + ID de vídeo de 11 caracteres. Recusa playlist/canal sem `v=`. */
export function parseYouTubeVideoId(raw: string): string | null {
  if (!isAllowedYouTubeUrl(raw)) return null
  return extractYouTubeId(raw)
}
