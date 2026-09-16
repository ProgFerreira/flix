import { describe, it, expect } from "vitest"
import { UploadError, streamMultipartVideo } from "@/lib/upload-stream"

function mp4Header(): Buffer {
  return Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0])
}

function multipart(fileBytes: Buffer, extraFields: Record<string, string> = {}) {
  const boundary = "----VitestBoundary"
  const chunks: Buffer[] = []
  for (const [name, value] of Object.entries(extraFields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ))
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
  ))
  chunks.push(fileBytes)
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`))
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

describe("streamMultipartVideo", () => {
  it("rejects a request that is not multipart", async () => {
    const req = new Request("http://localhost/upload", { method: "POST", body: "nope" })
    await expect(streamMultipartVideo(req)).rejects.toBeInstanceOf(UploadError)
  })

  it("writes a small file to a temp path and captures magic bytes", async () => {
    const header = mp4Header()
    const { body, contentType } = multipart(header, { title: "Demo" })
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    })
    const result = await streamMultipartVideo(req)
    expect(result.fields.title).toBe("Demo")
    expect(result.size).toBe(header.length)
    expect(result.header[4]).toBe(0x66)
    expect(result.tempPath.length).toBeGreaterThan(0)
    const { unlink } = await import("fs/promises")
    await unlink(result.tempPath)
  })

  it("rejects an empty file", async () => {
    const { body, contentType } = multipart(Buffer.alloc(0))
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    })
    await expect(streamMultipartVideo(req)).rejects.toBeInstanceOf(UploadError)
  })

  it("captures bytes that fail video MIME detection", async () => {
    const pdf = Buffer.from("%PDF-1.4........")
    const { body, contentType } = multipart(pdf)
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    })
    const result = await streamMultipartVideo(req)
    const { detectVideoMime } = await import("@/lib/video-storage")
    expect(detectVideoMime(result.header)).toBeNull()
    const { unlink } = await import("fs/promises")
    await unlink(result.tempPath)
  })

  it("rejects when the stream exceeds the size cap", async () => {
    const { body, contentType } = multipart(Buffer.alloc(64))
    const req = new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    })
    await expect(streamMultipartVideo(req, 16)).rejects.toBeInstanceOf(UploadError)
  })
})
