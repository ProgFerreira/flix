import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const optionalUserId = vi.fn()
const resolveCatalogAccess = vi.fn()

const prisma = {
  watchProgress: { findUnique: vi.fn(), upsert: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
  optionalUserId: (...args: unknown[]) => optionalUserId(...args),
}))

vi.mock("@/lib/catalog-access", () => ({
  resolveCatalogAccess: (...args: unknown[]) => resolveCatalogAccess(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/catalog/[id]/progress", () => {
  beforeEach(() => {
    optionalUserId.mockReset()
    prisma.watchProgress.findUnique.mockReset()
  })

  it("returns zero seconds for a visitor", async () => {
    optionalUserId.mockResolvedValue(null)
    const { GET } = await import("@/app/api/catalog/[id]/progress/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/5/progress"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ seconds: 0 })
    expect(prisma.watchProgress.findUnique).not.toHaveBeenCalled()
  })

  it("returns stored progress for the authenticated user", async () => {
    optionalUserId.mockResolvedValue(7)
    prisma.watchProgress.findUnique.mockResolvedValue({ seconds: 90 })
    const { GET } = await import("@/app/api/catalog/[id]/progress/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/5/progress"), {
      params: Promise.resolve({ id: "5" }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ seconds: 90 })
  })
})

describe("PATCH /api/catalog/[id]/progress", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    resolveCatalogAccess.mockReset()
    prisma.watchProgress.upsert.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PATCH } = await import("@/app/api/catalog/[id]/progress/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/catalog/5/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: 10 }),
      }),
      { params: Promise.resolve({ id: "5" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid seconds", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    resolveCatalogAccess.mockResolvedValue({ video: { id: 5 } })
    const { PATCH } = await import("@/app/api/catalog/[id]/progress/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/catalog/5/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: -1 }),
      }),
      { params: Promise.resolve({ id: "5" }) },
    )
    expect(res.status).toBe(400)
    expect(prisma.watchProgress.upsert).not.toHaveBeenCalled()
  })

  it("upserts progress when access is allowed", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    resolveCatalogAccess.mockResolvedValue({ video: { id: 5 } })
    prisma.watchProgress.upsert.mockResolvedValue({ seconds: 15 })
    const { PATCH } = await import("@/app/api/catalog/[id]/progress/route")
    const res = await PATCH(
      new NextRequest("http://localhost/api/catalog/5/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: 15 }),
      }),
      { params: Promise.resolve({ id: "5" }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.watchProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_videoId: { userId: 7, videoId: 5 } },
      create: { userId: 7, videoId: 5, seconds: 15 },
      update: { seconds: 15 },
    }))
    expect(await res.json()).toEqual({ seconds: 15 })
  })
})
