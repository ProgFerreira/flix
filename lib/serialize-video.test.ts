import { describe, it, expect } from "vitest"
import { serializeVideo } from "@/lib/serialize-video"

describe("serializeVideo", () => {
  it("turns BigInt fileSize into a number so JSON.stringify works", () => {
    const out = serializeVideo({ id: 1, title: "Aula", fileSize: 1024n, filePath: "storage/videos/x.mp4" })
    expect(out.fileSize).toBe(1024)
    expect(JSON.stringify(out)).toContain('"fileSize":1024')
    expect(out).not.toHaveProperty("filePath")
  })

  it("keeps null fileSize as null", () => {
    const out = serializeVideo({ id: 2, fileSize: null, filePath: null })
    expect(out.fileSize).toBeNull()
  })

  it("omits disk paths and exposes 480 + source when a preview exists", () => {
    const out = serializeVideo({
      id: 3,
      status: "ready",
      fileSize: 10n,
      filePath: "orig.mov",
      previewPath: "low.mp4",
      playbackPath: "play.mp4",
      thumbPath: "t.jpg",
      processingStartedAt: new Date(),
    })
    expect(out).not.toHaveProperty("filePath")
    expect(out).not.toHaveProperty("previewPath")
    expect(out).not.toHaveProperty("playbackPath")
    expect(out).not.toHaveProperty("thumbPath")
    expect(out).not.toHaveProperty("processingStartedAt")
    expect(out.qualities).toEqual(["480", "source"])
  })

  it("leaves youtube rows without playback qualities", () => {
    const out = serializeVideo({ id: 4, status: "ready", thumbnail: "https://img.youtube.com/x.jpg" })
    expect(out.qualities).toEqual([])
  })
})
