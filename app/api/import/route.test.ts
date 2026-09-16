import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class QuotaExceededError extends Error {
  constructor(message = "Limite do plano atingido") {
    super(message)
    this.name = "QuotaExceededError"
  }
}

const requireUserId = vi.fn()
const claimVideoSlot = vi.fn()

const prisma = {
  category: { findFirst: vi.fn(), create: vi.fn() },
  video: { findFirst: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: (...args: unknown[]) => claimVideoSlot(...args),
  QuotaExceededError,
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/import", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    claimVideoSlot.mockReset()
    prisma.category.findFirst.mockReset()
    prisma.category.create.mockReset()
    prisma.video.findFirst.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/import/route")
    const res = await POST(post({ videos: [] }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for an invalid payload", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { POST } = await import("@/app/api/import/route")
    const res = await POST(post({ videos: [{ title: "sem url" }] }))
    expect(res.status).toBe(400)
  })

  it("skips videos that already exist and imports new ones", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.category.findFirst.mockResolvedValue({ id: 1, name: "JS" })
    prisma.video.findFirst
      .mockResolvedValueOnce({ id: 9 })
      .mockResolvedValueOnce(null)
    claimVideoSlot.mockResolvedValue({ id: 10 })
    const { POST } = await import("@/app/api/import/route")
    const res = await POST(post({
      categories: [{ name: "JS" }],
      videos: [
        { url: "https://youtu.be/aaaaaaaaaaa", videoId: "aaaaaaaaaaa", title: "Já tem", thumbnail: "t.jpg" },
        { url: "https://youtu.be/bbbbbbbbbbb", videoId: "bbbbbbbbbbb", title: "Novo", thumbnail: "t.jpg" },
      ],
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ imported: 1, skipped: 1 })
    expect(claimVideoSlot).toHaveBeenCalledTimes(1)
  })

  it("returns 403 when the first video already exceeds quota", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    prisma.video.findFirst.mockResolvedValue(null)
    claimVideoSlot.mockRejectedValue(new QuotaExceededError("Limite do plano atingido."))
    const { POST } = await import("@/app/api/import/route")
    const res = await POST(post({
      videos: [{ url: "https://youtu.be/aaaaaaaaaaa", videoId: "aaaaaaaaaaa", title: "Novo", thumbnail: "t.jpg" }],
    }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.imported).toBe(0)
    expect(json.error).toMatch(/Limite/)
  })
})
