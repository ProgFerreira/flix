import { describe, it, expect } from "vitest"
import { parseProbe, isBrowserPlayable, formatDuration, FfmpegError } from "@/lib/ffmpeg"

const h264Aac = JSON.stringify({
  format: { duration: "125.4" },
  streams: [
    { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, duration: "125.4" },
    { codec_type: "audio", codec_name: "aac" },
  ],
})

describe("parseProbe", () => {
  it("reads duration, size and codecs from ffprobe JSON", () => {
    const probe = parseProbe(h264Aac)
    expect(probe.durationSec).toBeCloseTo(125.4)
    expect(probe.width).toBe(1920)
    expect(probe.height).toBe(1080)
    expect(probe.videoCodec).toBe("h264")
    expect(probe.audioCodec).toBe("aac")
    expect(probe.hasAudio).toBe(true)
  })

  it("rejects JSON without a video stream", () => {
    expect(() => parseProbe(JSON.stringify({ streams: [{ codec_type: "audio", codec_name: "aac" }] }))).toThrow(FfmpegError)
  })
})

describe("isBrowserPlayable", () => {
  const probe = parseProbe(h264Aac)

  it("accepts MP4 H.264 + AAC", () => {
    expect(isBrowserPlayable(probe, "video/mp4")).toBe(true)
  })

  it("rejects QuickTime even when the inner codec is H.264", () => {
    expect(isBrowserPlayable(probe, "video/quicktime")).toBe(false)
  })

  it("rejects HEVC inside MP4", () => {
    const hevc = { ...probe, videoCodec: "hevc" }
    expect(isBrowserPlayable(hevc, "video/mp4")).toBe(false)
  })

  it("accepts WebM VP9", () => {
    const vp9 = { ...probe, videoCodec: "vp9", audioCodec: "opus" }
    expect(isBrowserPlayable(vp9, "video/webm")).toBe(true)
  })
})

describe("formatDuration", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(formatDuration(5)).toBe("0:05")
    expect(formatDuration(125)).toBe("2:05")
    expect(formatDuration(3723)).toBe("1:02:03")
  })

  it("returns empty for invalid values", () => {
    expect(formatDuration(Number.NaN)).toBe("")
    expect(formatDuration(-1)).toBe("")
  })
})
