import { describe, it, expect } from "vitest"
import { detectReceiptMime } from "@/lib/receipt-storage"

describe("detectReceiptMime", () => {
  it("detects jpeg / png / pdf / webp", () => {
    const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0])
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(detectReceiptMime(jpeg)).toBe("image/jpeg")
    expect(detectReceiptMime(png)).toBe("image/png")
    expect(detectReceiptMime(pdf)).toBe("application/pdf")
    expect(detectReceiptMime(webp)).toBe("image/webp")
  })

  it("rejects unknown bytes", () => {
    expect(detectReceiptMime(new Uint8Array(12))).toBeNull()
  })
})
