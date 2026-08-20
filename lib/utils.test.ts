import { describe, it, expect } from "vitest"
import { extractYouTubeId } from "@/lib/utils"

describe("extractYouTubeId", () => {
  it("extracts id from watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("extracts id from short URL", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("returns null for non-YouTube URL", () => {
    expect(extractYouTubeId("https://example.com/video")).toBeNull()
  })
})
