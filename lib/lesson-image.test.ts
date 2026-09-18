import { describe, it, expect } from "vitest"
import {
  detectImageMime,
  generateImageThumbFilename,
  thumbContentType,
  MAX_LESSON_IMAGE_BYTES,
} from "@/lib/lesson-image"

describe("detectImageMime", () => {
  it("detects jpeg / png / webp", () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(detectImageMime(jpeg)).toBe("image/jpeg")
    expect(detectImageMime(png)).toBe("image/png")
    expect(detectImageMime(webp)).toBe("image/webp")
  })

  it("rejects pdf, empty and unknown bytes", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(detectImageMime(pdf)).toBeNull()
    expect(detectImageMime(new Uint8Array(12))).toBeNull()
    expect(detectImageMime(new Uint8Array([0xFF, 0xD8]))).toBeNull()
  })
})

describe("generateImageThumbFilename", () => {
  it("uses the extension that matches the mime type", () => {
    expect(generateImageThumbFilename("image/jpeg")).toMatch(/\.jpg$/)
    expect(generateImageThumbFilename("image/png")).toMatch(/\.png$/)
    expect(generateImageThumbFilename("image/webp")).toMatch(/\.webp$/)
  })

  it("produces unique names", () => {
    const a = generateImageThumbFilename("image/jpeg")
    const b = generateImageThumbFilename("image/jpeg")
    expect(a).not.toBe(b)
  })
})

describe("thumbContentType", () => {
  it("maps stored extensions to image mime types", () => {
    expect(thumbContentType("a.jpg")).toBe("image/jpeg")
    expect(thumbContentType("a.jpeg")).toBe("image/jpeg")
    expect(thumbContentType("a.png")).toBe("image/png")
    expect(thumbContentType("a.webp")).toBe("image/webp")
  })

  it("falls back to jpeg for unknown extensions", () => {
    expect(thumbContentType("a.bin")).toBe("image/jpeg")
  })
})

describe("MAX_LESSON_IMAGE_BYTES", () => {
  it("caps lesson images at 5 MB", () => {
    expect(MAX_LESSON_IMAGE_BYTES).toBe(5 * 1024 * 1024)
  })
})
