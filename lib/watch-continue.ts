export const CONTINUE_MIN_SECONDS = 5
export const CONTINUE_DONE_RATIO = 0.9
export const CONTINUE_LIMIT = 12
export const CONTINUE_FETCH = 36

export type ContinueVideo = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  channelName: string | null
  source: "youtube" | "upload" | "article"
  videoId: string | null
  requiredPlan: string
  published: boolean
  userId: number
  previewPath?: string | null
}

export type ContinueRow = {
  seconds: number
  video: ContinueVideo
}

export type ContinueAccess = {
  userId: number
  canAccess: (video: ContinueVideo) => boolean
}

export type ContinueItem = Omit<ContinueVideo, "userId" | "published" | "previewPath"> & {
  progressSeconds: number
  progressPercent: number | null
  remainingLabel: string
  mine: boolean
  locked: false
  qualities: string[]
}

export function durationToSeconds(d: string | null | undefined): number {
  if (!d) return 0
  const ms = d.trim().match(/^(\d+)m(\d+)s$/)
  if (ms) return parseInt(ms[1], 10) * 60 + parseInt(ms[2], 10)
  const p = d.split(":").map(Number)
  if (p.length === 2) return (p[0] ?? 0) * 60 + (p[1] ?? 0)
  if (p.length === 3) return (p[0] ?? 0) * 3600 + (p[1] ?? 0) * 60 + (p[2] ?? 0)
  return 0
}

/** Ainda no meio — não começou agora há pouco nem chegou aos ~90%. */
export function isContinueWatching(seconds: number, duration: string | null | undefined): boolean {
  if (!Number.isFinite(seconds) || seconds < CONTINUE_MIN_SECONDS) return false
  const total = durationToSeconds(duration)
  if (total <= 0) return true
  return seconds < total * CONTINUE_DONE_RATIO
}

export function continueProgressPercent(seconds: number, duration: string | null | undefined): number | null {
  const total = durationToSeconds(duration)
  if (total <= 0 || !Number.isFinite(seconds) || seconds <= 0) return null
  return Math.min(99, Math.max(1, Math.round((seconds / total) * 100)))
}

export function remainingLabel(seconds: number, duration: string | null | undefined): string {
  const total = durationToSeconds(duration)
  if (total <= 0) return "Continuar"
  const left = Math.max(0, total - seconds)
  if (left < 60) return "Menos de 1 min"
  const mins = Math.round(left / 60)
  return mins === 1 ? "1 min restante" : `${mins} min restantes`
}

/**
 * Filtra progresso recente: acessível, não concluído, no máximo CONTINUE_LIMIT.
 * A ordem de `rows` (updatedAt desc) é preservada.
 */
export function selectContinueWatching(rows: ContinueRow[], access: ContinueAccess): ContinueItem[] {
  const items: ContinueItem[] = []
  for (const row of rows) {
    if (items.length >= CONTINUE_LIMIT) break
    const { video, seconds } = row
    if (!isContinueWatching(seconds, video.duration)) continue
    if (!access.canAccess(video)) continue
    items.push({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      channelName: video.channelName,
      source: video.source,
      videoId: video.videoId,
      requiredPlan: video.requiredPlan,
      progressSeconds: Math.floor(seconds),
      progressPercent: continueProgressPercent(seconds, video.duration),
      remainingLabel: remainingLabel(seconds, video.duration),
      mine: video.userId === access.userId,
      locked: false,
      qualities: video.previewPath ? ["480", "source"] : video.source === "upload" ? ["source"] : [],
    })
  }
  return items
}
