import { prisma } from "@/lib/prisma"
import {
  ffmpegAvailable,
  probeVideo,
  extractThumbnail,
  transcodePreview,
  makePlaybackMp4,
  isBrowserPlayable,
  formatDuration,
  FfmpegError,
} from "@/lib/ffmpeg"
import {
  resolveStoredFilePath,
  resolveThumbPath,
  generateThumbFilename,
  generateDerivedFilename,
  ensureStorageDir,
  ensureThumbsDir,
  removeVideoFiles,
  PLACEHOLDER_THUMB,
} from "@/lib/video-storage"

const STALE_MS = 3 * 60 * 60 * 1000
const FFMPEG_MISSING = "FFmpeg não encontrado. Instale o FFmpeg e defina FFMPEG_PATH (e FFPROBE_PATH) no .env."

const running = new Set<number>()
let chain: Promise<unknown> = Promise.resolve()

export function enqueueVideoProcessing(videoId: number): void {
  chain = chain
    .then(() => processVideoJob(videoId))
    .catch((err) => {
      console.error("[video-process]", videoId, err)
    })
}

export async function listDueVideoIds(limit = 2): Promise<number[]> {
  const stale = new Date(Date.now() - STALE_MS)
  const due = await prisma.video.findMany({
    where: {
      source: "upload",
      status: "processing",
      OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: stale } }],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })
  return due.map((row) => row.id)
}

export async function processDueVideos(limit = 2): Promise<{ claimed: number }> {
  const ids = await listDueVideoIds(limit)
  for (const id of ids) {
    await processVideoJob(id)
  }
  return { claimed: ids.length }
}

export async function processVideoJob(videoId: number): Promise<{ ok: boolean; skipped?: boolean }> {
  if (running.has(videoId)) return { ok: true, skipped: true }
  running.add(videoId)
  try {
    return await runPipeline(videoId)
  } finally {
    running.delete(videoId)
  }
}

function clipError(err: unknown): string {
  const raw = err instanceof FfmpegError
    ? err.message
    : err instanceof Error
      ? err.message
      : "Falha ao processar o vídeo"
  return raw.slice(0, 500)
}

async function runPipeline(videoId: number): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!(await ffmpegAvailable())) {
    await prisma.video.update({
      where: { id: videoId },
      data: { processError: FFMPEG_MISSING },
    }).catch(() => undefined)
    return { ok: false, skipped: true }
  }

  const stale = new Date(Date.now() - STALE_MS)
  const claimed = await prisma.video.updateMany({
    where: {
      id: videoId,
      source: "upload",
      status: "processing",
      OR: [{ processingStartedAt: null }, { processingStartedAt: { lt: stale } }],
    },
    data: { processingStartedAt: new Date(), processError: null },
  })
  if (claimed.count !== 1) return { ok: true, skipped: true }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, filePath: true, mimeType: true },
  })
  if (!video?.filePath) {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "error", processError: "Arquivo original ausente" },
    })
    return { ok: false }
  }

  const input = resolveStoredFilePath(video.filePath)
  const thumbName = generateThumbFilename()
  const previewName = generateDerivedFilename()
  const playbackName = generateDerivedFilename()
  const derived: { previewPath?: string; playbackPath?: string; thumbPath?: string } = {}

  ensureStorageDir()
  ensureThumbsDir()

  try {
    const probe = await probeVideo(input)
    const thumbAt = probe.durationSec >= 2 ? 1 : 0
    await extractThumbnail(input, resolveThumbPath(thumbName), thumbAt)
    derived.thumbPath = thumbName

    await transcodePreview(input, resolveStoredFilePath(previewName), probe.hasAudio)
    derived.previewPath = previewName

    let playbackPath: string | null = null
    if (!isBrowserPlayable(probe, video.mimeType ?? "")) {
      const canCopy =
        (probe.videoCodec === "h264" || probe.videoCodec === "avc1") &&
        (!probe.hasAudio || probe.audioCodec === "aac" || probe.audioCodec === "mp3")
      await makePlaybackMp4(input, resolveStoredFilePath(playbackName), {
        copy: canCopy,
        hasAudio: probe.hasAudio,
      })
      playbackPath = playbackName
      derived.playbackPath = playbackName
    }

    const duration = formatDuration(probe.durationSec) || null
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "ready",
        processError: null,
        processingStartedAt: null,
        thumbPath: thumbName,
        previewPath: previewName,
        playbackPath,
        thumbnail: `/api/videos/${videoId}/thumbnail`,
        duration,
      },
    })
    return { ok: true }
  } catch (err) {
    await removeVideoFiles(derived)
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "error",
        processError: clipError(err),
        thumbnail: PLACEHOLDER_THUMB,
      },
    }).catch(() => undefined)
    return { ok: false }
  }
}
