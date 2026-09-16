import { describe, it, expect } from "vitest"
import { isAllowedYouTubeUrl, parseYouTubeVideoId } from "@/lib/youtube-url"

describe("isAllowedYouTubeUrl", () => {
  it("accepts youtube.com playlist URLs", () => {
    expect(isAllowedYouTubeUrl("https://www.youtube.com/playlist?list=PLabc")).toBe(true)
    expect(isAllowedYouTubeUrl("https://youtube.com/playlist?list=PLabc")).toBe(true)
    expect(isAllowedYouTubeUrl("https://m.youtube.com/playlist?list=PLabc")).toBe(true)
  })

  it("accepts youtu.be", () => {
    expect(isAllowedYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true)
  })

  it("rejects localhost and loopback", () => {
    expect(isAllowedYouTubeUrl("http://127.0.0.1/playlist")).toBe(false)
    expect(isAllowedYouTubeUrl("http://localhost:3000/secret")).toBe(false)
    expect(isAllowedYouTubeUrl("http://[::1]/playlist")).toBe(false)
  })

  it("rejects arbitrary hosts", () => {
    expect(isAllowedYouTubeUrl("https://evil.example/playlist")).toBe(false)
    expect(isAllowedYouTubeUrl("https://169.254.169.254/latest/meta-data/")).toBe(false)
  })

  it("rejects non-http schemes", () => {
    expect(isAllowedYouTubeUrl("file:///etc/passwd")).toBe(false)
    expect(isAllowedYouTubeUrl("javascript:alert(1)")).toBe(false)
  })

  it("rejects malformed strings", () => {
    expect(isAllowedYouTubeUrl("not a url")).toBe(false)
  })
})

describe("parseYouTubeVideoId", () => {
  it("extracts the id from watch and short URLs", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(parseYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })

  it("rejects playlist-only and foreign hosts", () => {
    expect(parseYouTubeVideoId("https://www.youtube.com/playlist?list=PLabc")).toBeNull()
    expect(parseYouTubeVideoId("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull()
  })
})
