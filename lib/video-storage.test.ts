import { describe, it, expect } from "vitest"
import { validateUpload, generateStoredFilename, resolveStoredFilePath, parseRangeHeader, MAX_UPLOAD_BYTES, STORAGE_DIR } from "@/lib/video-storage"

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
