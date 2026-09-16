import { describe, it, expect } from "vitest"
import { validateUpload, generateStoredFilename, resolveStoredFilePath, parseRangeHeader, detectVideoMime, fileCacheTag, MAX_UPLOAD_BYTES, STORAGE_DIR, pickStreamAsset } from "@/lib/video-storage"

function bytes(...parts: Array<number | string>): Uint8Array {
  const chunks = parts.map((p) =>
    typeof p === "string" ? Array.from(p).map((c) => c.charCodeAt(0)) : [p],
  )
  return Uint8Array.from(chunks.flat())
}

describe("detectVideoMime", () => {
  it("detects MP4 via ftyp/isom", () => {
    const header = bytes(0, 0, 0, 24, "ftyp", "isom")
    expect(detectVideoMime(header)).toBe("video/mp4")
  })

  it("detects QuickTime via ftyp/qt", () => {
    const header = bytes(0, 0, 0, 20, "ftyp", "qt  ")
    expect(detectVideoMime(header)).toBe("video/quicktime")
  })

  it("detects WebM via EBML header", () => {
    const header = bytes(0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0, 0, 0, 0, 0)
    expect(detectVideoMime(header)).toBe("video/webm")
  })

  it("rejects a PDF pretending to be a video", () => {
    const header = bytes("%PDF-1.4....")
    expect(detectVideoMime(header)).toBeNull()
  })

  it("rejects a too-short buffer", () => {
    expect(detectVideoMime(bytes(0, 0, 0))).toBeNull()
  })
})

describe("validateUpload", () => {
  it("accepts a valid mp4 within the size limit", () => {
    expect(validateUpload({ mimeType: "video/mp4", size: 1024 })).toEqual({ ok: true })
  })

  it("rejects unsupported mime types", () => {
    const result = validateUpload({ mimeType: "application/pdf", size: 1024 })
    expect(result.ok).toBe(false)
  })

  it("rejects empty files", () => {
    const result = validateUpload({ mimeType: "video/mp4", size: 0 })
    expect(result.ok).toBe(false)
  })

  it("rejects files above the max size", () => {
    const result = validateUpload({ mimeType: "video/mp4", size: MAX_UPLOAD_BYTES + 1 })
    expect(result.ok).toBe(false)
  })

  it("accepts webm and mov", () => {
    expect(validateUpload({ mimeType: "video/webm", size: 10 }).ok).toBe(true)
    expect(validateUpload({ mimeType: "video/quicktime", size: 10 }).ok).toBe(true)
  })
})

describe("generateStoredFilename", () => {
  it("produces unique names for the same mime type", () => {
    const a = generateStoredFilename("video/mp4")
    const b = generateStoredFilename("video/mp4")
    expect(a).not.toBe(b)
    expect(a.endsWith(".mp4")).toBe(true)
  })

  it("falls back to .mp4 for unknown mime types", () => {
    expect(generateStoredFilename("video/unknown").endsWith(".mp4")).toBe(true)
  })
})

describe("resolveStoredFilePath", () => {
  it("joins the filename under the storage dir", () => {
    const resolved = resolveStoredFilePath("abc.mp4")
    expect(resolved.startsWith(STORAGE_DIR)).toBe(true)
    expect(resolved.endsWith("abc.mp4")).toBe(true)
  })

  it("strips directory traversal attempts down to the basename", () => {
    const resolved = resolveStoredFilePath("../../etc/passwd")
    expect(resolved).toBe(resolveStoredFilePath("passwd"))
    expect(resolved.startsWith(STORAGE_DIR)).toBe(true)
  })
})

describe("fileCacheTag", () => {
  it("builds a strong etag from size and mtime", () => {
    expect(fileCacheTag({ size: 100, mtimeMs: 1700000000123 })).toBe('"100-1700000000123"')
  })

  it("falls back to zero mtime when absent", () => {
    expect(fileCacheTag({ size: 100 })).toBe('"100-0"')
  })
})

describe("parseRangeHeader", () => {
  const fileSize = 1000

  it("returns null when there is no range header (serve whole file)", () => {
    expect(parseRangeHeader(null, fileSize)).toBeNull()
    expect(parseRangeHeader(undefined, fileSize)).toBeNull()
  })

  it("parses a simple bounded range", () => {
    expect(parseRangeHeader("bytes=0-99", fileSize)).toEqual({ start: 0, end: 99 })
  })

  it("parses an open-ended range (from start to EOF)", () => {
    expect(parseRangeHeader("bytes=500-", fileSize)).toEqual({ start: 500, end: 999 })
  })

  it("parses a suffix range (last N bytes)", () => {
    expect(parseRangeHeader("bytes=-100", fileSize)).toEqual({ start: 900, end: 999 })
  })

  it("clamps an end beyond the file size", () => {
    expect(parseRangeHeader("bytes=900-5000", fileSize)).toEqual({ start: 900, end: 999 })
  })

  it("rejects a malformed header", () => {
    expect(parseRangeHeader("not-a-range", fileSize)).toBeNull()
  })

  it("rejects a start greater than the end", () => {
    expect(parseRangeHeader("bytes=500-100", fileSize)).toBeNull()
  })

  it("rejects an empty range", () => {
    expect(parseRangeHeader("bytes=-", fileSize)).toBeNull()
  })
})

describe("pickStreamAsset", () => {
  const video = {
    filePath: "orig.mov",
    previewPath: "low.mp4",
    playbackPath: "play.mp4",
    mimeType: "video/quicktime",
  }

  it("defaults to the 480p variant when it exists", () => {
    expect(pickStreamAsset(video, null)).toEqual({ filename: "low.mp4", mimeType: "video/mp4" })
    expect(pickStreamAsset(video, "480")).toEqual({ filename: "low.mp4", mimeType: "video/mp4" })
  })

  it("serves the original file when quality=source", () => {
    expect(pickStreamAsset(video, "source")).toEqual({ filename: "orig.mov", mimeType: "video/quicktime" })
  })

  it("falls back to playback MP4 then original when there is no preview", () => {
    expect(pickStreamAsset({ ...video, previewPath: null }, null)).toEqual({
      filename: "play.mp4",
      mimeType: "video/mp4",
    })
    expect(pickStreamAsset({ filePath: "a.mp4", mimeType: "video/mp4" }, null)).toEqual({
      filename: "a.mp4",
      mimeType: "video/mp4",
    })
  })
})
