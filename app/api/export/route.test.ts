import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const requireUserId = vi.fn()
const prisma = {
  video: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/export", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    prisma.video.findMany.mockReset()
    prisma.category.findMany.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { GET } = await import("@/app/api/export/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("exports the user library without filePath", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.category.findMany.mockResolvedValue([{ id: 1, name: "JS", color: "#fff" }])
    prisma.video.findMany.mockResolvedValue([{
      id: 3,
      title: "Aula",
      fileSize: 2048n,
      filePath: "secret.mp4",
      videoCategories: [{ category: { id: 1, name: "JS" } }],
    }])
    const { GET } = await import("@/app/api/export/route")
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toMatch(/flix-export-/)
    const json = await res.json()
    expect(json.categories).toHaveLength(1)
    expect(json.videos[0].title).toBe("Aula")
    expect(json.videos[0].fileSize).toBe(2048)
    expect(json.videos[0].filePath).toBeUndefined()
    expect(json.videos[0].videoCategories).toBeUndefined()
    expect(json.videos[0].categories).toEqual([{ id: 1, name: "JS" }])
  })
})
