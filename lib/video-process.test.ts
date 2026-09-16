import { beforeEach, describe, expect, it, vi } from "vitest"

const ffmpeg = vi.hoisted(() => ({
  ffmpegAvailable: vi.fn(),
  probeVideo: vi.fn(),
  extractThumbnail: vi.fn(),
  transcodePreview: vi.fn(),
  makePlaybackMp4: vi.fn(),
  isBrowserPlayable: vi.fn(),
  formatDuration: vi.fn(),
  FfmpegError: class FfmpegError extends Error {},
}))

const prisma = vi.hoisted(() => ({
  video: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock("@/lib/ffmpeg", () => ffmpeg)
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/video-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-storage")>()
  return {
    ...actual,
    ensureStorageDir: vi.fn(),
    ensureThumbsDir: vi.fn(),
    removeVideoFiles: vi.fn(async () => undefined),
    resolveStoredFilePath: (name: string) => `/tmp/${name}`,
    resolveThumbPath: (name: string) => `/tmp/thumbs/${name}`,
  }
})

import { processVideoJob } from "@/lib/video-process"

const probe = {
  durationSec: 60,
  width: 1280,
  height: 720,
  videoCodec: "h264",
  audioCodec: "aac",
  hasAudio: true,
}

describe("processVideoJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ffmpeg.ffmpegAvailable.mockResolvedValue(true)
    ffmpeg.probeVideo.mockResolvedValue(probe)
    ffmpeg.extractThumbnail.mockResolvedValue(undefined)
    ffmpeg.transcodePreview.mockResolvedValue(undefined)
    ffmpeg.makePlaybackMp4.mockResolvedValue(undefined)
    ffmpeg.isBrowserPlayable.mockReturnValue(true)
    ffmpeg.formatDuration.mockReturnValue("1:00")
    prisma.video.updateMany.mockResolvedValue({ count: 1 })
    prisma.video.findUnique.mockResolvedValue({ id: 9, filePath: "orig.mp4", mimeType: "video/mp4" })
    prisma.video.update.mockResolvedValue({})
  })

  it("marks ready with thumbnail, 480p and duration when the source already plays in the browser", async () => {
    const result = await processVideoJob(9)
    expect(result).toEqual({ ok: true })
    expect(ffmpeg.extractThumbnail).toHaveBeenCalled()
    expect(ffmpeg.transcodePreview).toHaveBeenCalled()
    expect(ffmpeg.makePlaybackMp4).not.toHaveBeenCalled()
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 },
      data: expect.objectContaining({
        status: "ready",
        duration: "1:00",
        thumbnail: "/api/videos/9/thumbnail",
        playbackPath: null,
      }),
    }))
  })

  it("transcodes a playback MP4 when the original is not browser-playable", async () => {
    prisma.video.findUnique.mockResolvedValue({ id: 9, filePath: "orig.mov", mimeType: "video/quicktime" })
    ffmpeg.isBrowserPlayable.mockReturnValue(false)
    await processVideoJob(9)
    expect(ffmpeg.makePlaybackMp4).toHaveBeenCalled()
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "ready",
        playbackPath: expect.stringMatching(/\.mp4$/),
      }),
    }))
  })

  it("marks error when FFmpeg throws after the job was claimed", async () => {
    ffmpeg.probeVideo.mockRejectedValue(new ffmpeg.FfmpegError("ffprobe saiu com código 1"))
    const result = await processVideoJob(9)
    expect(result.ok).toBe(false)
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "error" }),
    }))
  })

  it("skips claiming when FFmpeg is missing and records the reason", async () => {
    ffmpeg.ffmpegAvailable.mockResolvedValue(false)
    const result = await processVideoJob(11)
    expect(result).toEqual({ ok: false, skipped: true })
    expect(prisma.video.updateMany).not.toHaveBeenCalled()
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ processError: expect.stringContaining("FFmpeg") }),
    }))
  })
})
