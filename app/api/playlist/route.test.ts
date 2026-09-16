import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

class QuotaExceededError extends Error {
  constructor(message = "Limite do plano atingido") {
    super(message)
    this.name = "QuotaExceededError"
  }
}

const requireUserId = vi.fn()
const isAllowedYouTubeUrl = vi.fn()
const ownedCategoryIds = vi.fn(async () => [])
const checkVideoQuota = vi.fn()
const claimVideoSlot = vi.fn()

const prisma = {
  video: { findFirst: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/youtube-url", () => ({
  isAllowedYouTubeUrl: (...args: unknown[]) => isAllowedYouTubeUrl(...args),
}))

vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: (...args: unknown[]) => ownedCategoryIds(...args),
}))

vi.mock("@/lib/plan-quota", () => ({
  claimVideoSlot: (...args: unknown[]) => claimVideoSlot(...args),
  checkVideoQuota: (...args: unknown[]) => checkVideoQuota(...args),
  QuotaExceededError,
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function post(body: unknown) {
  return new NextRequest("http://localhost/api/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/playlist", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    requireUserId.mockReset()
    isAllowedYouTubeUrl.mockReset()
    ownedCategoryIds.mockReset()
    ownedCategoryIds.mockResolvedValue([])
    checkVideoQuota.mockReset()
    claimVideoSlot.mockReset()
    prisma.video.findFirst.mockReset()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { POST } = await import("@/app/api/playlist/route")
    const res = await POST(post({ url: "https://www.youtube.com/playlist?list=abc" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for a non-YouTube URL", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    isAllowedYouTubeUrl.mockReturnValue(false)
    const { POST } = await import("@/app/api/playlist/route")
    const res = await POST(post({ url: "https://evil.test/playlist" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Use uma URL de playlist do YouTube" })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("returns 403 when there are no remaining slots", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    isAllowedYouTubeUrl.mockReturnValue(true)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "watch?v=abcdefghijk extra",
    })
    checkVideoQuota.mockResolvedValue({ remaining: 0, error: "Limite do plano atingido." })
    const { POST } = await import("@/app/api/playlist/route")
    const res = await POST(post({ url: "https://www.youtube.com/playlist?list=PL123" }))
    expect(res.status).toBe(403)
    expect(claimVideoSlot).not.toHaveBeenCalled()
  })

  it("imports unique videos from the playlist HTML", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    isAllowedYouTubeUrl.mockReturnValue(true)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("oembed")) {
        return { ok: true, json: async () => ({ title: "Aula 1", author_name: "Canal" }) }
      }
      return { ok: true, text: async () => "watch?v=abcdefghijk and watch?v=abcdefghijk" }
    })
    checkVideoQuota.mockResolvedValue({ remaining: 10 })
    prisma.video.findFirst.mockResolvedValue(null)
    claimVideoSlot.mockImplementation(async (_uid: number, fn: (tx: { video: { create: ReturnType<typeof vi.fn> } }) => unknown) => {
      const created = { id: 1, title: "Aula 1" }
      return fn({ video: { create: vi.fn().mockResolvedValue(created) } })
    })
    const { POST } = await import("@/app/api/playlist/route")
    const res = await POST(post({ url: "https://www.youtube.com/playlist?list=PL123" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imported).toBe(1)
    expect(json.videos[0].title).toBe("Aula 1")
  })
})
