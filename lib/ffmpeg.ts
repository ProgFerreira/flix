import { spawn } from "child_process"

export class FfmpegError extends Error {
  constructor(message: string, public stderr = "") {
    super(message)
  }
}

export type ProbeInfo = {
  durationSec: number
  width: number
  height: number
  videoCodec: string
  audioCodec: string | null
  hasAudio: boolean
}

export function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg"
}

export function ffprobeBin(): string {
  return process.env.FFPROBE_PATH?.trim() || "ffprobe"
}

export function runCommand(bin: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let stdout = ""
    let stderr = ""
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          child.kill()
          reject(new FfmpegError(`Tempo esgotado ao executar ${bin}`))
        }, opts.timeoutMs)
      : null

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", (err) => {
      if (timer) clearTimeout(timer)
      reject(new FfmpegError(err.message))
    })
    child.on("close", (code) => {
      if (timer) clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new FfmpegError(`${bin} saiu com código ${code}`, stderr.slice(-2000)))
    })
  })
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await runCommand(ffmpegBin(), ["-version"], { timeoutMs: 8000 })
    await runCommand(ffprobeBin(), ["-version"], { timeoutMs: 8000 })
    return true
  } catch {
    return false
  }
}

export function parseProbe(json: string): ProbeInfo {
  let data: {
    format?: { duration?: string }
    streams?: Array<{
      codec_type?: string
      codec_name?: string
      width?: number
      height?: number
      duration?: string
    }>
  }
  try {
    data = JSON.parse(json)
  } catch {
    throw new FfmpegError("ffprobe devolveu JSON inválido")
  }

  const streams = data.streams ?? []
  const video = streams.find((s) => s.codec_type === "video")
  const audio = streams.find((s) => s.codec_type === "audio")
  if (!video) throw new FfmpegError("O arquivo não tem faixa de vídeo")

  const durationRaw = data.format?.duration ?? video.duration ?? "0"
  const durationSec = Number.parseFloat(durationRaw)

  return {
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
    width: video.width ?? 0,
    height: video.height ?? 0,
    videoCodec: (video.codec_name ?? "").toLowerCase(),
    audioCodec: audio?.codec_name ? audio.codec_name.toLowerCase() : null,
    hasAudio: Boolean(audio),
  }
}

/** MP4 H.264+AAC e WebM VP8/VP9/AV1 tocam nos browsers comuns; QuickTime/HEVC não. */
export function isBrowserPlayable(probe: ProbeInfo, mimeType: string): boolean {
  const videoOkH264 = probe.videoCodec === "h264" || probe.videoCodec === "avc1"
  const audioOkMp4 = !probe.hasAudio || probe.audioCodec === "aac" || probe.audioCodec === "mp3"
  if (mimeType === "video/mp4") return videoOkH264 && audioOkMp4

  const videoOkWebm = probe.videoCodec === "vp8" || probe.videoCodec === "vp9" || probe.videoCodec === "av1"
  if (mimeType === "video/webm") return videoOkWebm

  return false
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ""
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

export async function probeVideo(input: string): Promise<ProbeInfo> {
  const stdout = await runCommand(
    ffprobeBin(),
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", input],
    { timeoutMs: 30_000 },
  )
  return parseProbe(stdout)
}

export async function extractThumbnail(input: string, output: string, atSeconds: number): Promise<void> {
  const at = Number.isFinite(atSeconds) && atSeconds > 0 ? atSeconds : 0
  await runCommand(
    ffmpegBin(),
    ["-y", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3", output],
    { timeoutMs: 60_000 },
  )
}

export async function transcodePreview(input: string, output: string, hasAudio: boolean): Promise<void> {
  const args = [
    "-y", "-i", input,
    "-vf", "scale=-2:'min(ih,480)'",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "28",
    "-movflags", "+faststart",
  ]
  if (hasAudio) args.push("-c:a", "aac", "-b:a", "96k", "-ac", "2")
  else args.push("-an")
  args.push(output)
  await runCommand(ffmpegBin(), args)
}

export async function makePlaybackMp4(input: string, output: string, opts: { copy: boolean; hasAudio: boolean }): Promise<void> {
  if (opts.copy) {
    try {
      await runCommand(
        ffmpegBin(),
        ["-y", "-i", input, "-c", "copy", "-movflags", "+faststart", output],
        { timeoutMs: 120_000 },
      )
      return
    } catch {
      // PCM/HEVC dentro de MOV frequentemente quebra o remux; cai no transcode.
    }
  }
  const args = [
    "-y", "-i", input,
    "-vf", "scale=-2:'min(ih,1080)'",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-movflags", "+faststart",
  ]
  if (opts.hasAudio) args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2")
  else args.push("-an")
  args.push(output)
  await runCommand(ffmpegBin(), args)
}
