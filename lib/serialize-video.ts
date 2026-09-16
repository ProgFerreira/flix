type VideoLike = {
  id?: number
  fileSize?: bigint | number | null
  filePath?: string | null
  previewPath?: string | null
  playbackPath?: string | null
  thumbPath?: string | null
  processingStartedAt?: Date | null
  status?: string
}

const HIDDEN = ["filePath", "previewPath", "playbackPath", "thumbPath", "processingStartedAt"] as const

/** Converte BigInt, omite caminhos de disco e expõe as qualidades públicas. */
export function serializeVideo<T extends VideoLike>(video: T) {
  const rest = { ...video } as T & Record<string, unknown>
  for (const key of HIDDEN) delete rest[key]

  const qualities: string[] = []
  if (video.status === "ready" && (video.filePath || video.playbackPath)) {
    if (video.previewPath) qualities.push("480")
    qualities.push("source")
  }

  return {
    ...rest,
    fileSize: video.fileSize == null ? null : Number(video.fileSize),
    qualities,
  }
}
