import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const ownedCategoryIds = vi.fn()
const replaceVideoGrants = vi.fn()

const prisma = {
  video: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: (...args: unknown[]) => ownedCategoryIds(...args),
}))
vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    replaceVideoGrants: (...args: unknown[]) => replaceVideoGrants(...args),
  }
})
vi.mock("@/lib/video-storage", () => ({
  removeVideoFiles: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("PATCH /api/admin/videos/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    prisma.video.findUnique.mockReset()
    prisma.video.update.mockReset()
    prisma.$transaction.mockReset()
  })

  it("updates title and notes of an article lesson", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ source: "article", userId: 1 })
    prisma.video.update.mockResolvedValue({
      id: 44, title: "Novo", notes: "Corpo", source: "article", videoCategories: [],
    })
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma))
    const { PATCH } = await import("@/app/api/admin/videos/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/videos/44", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Novo", notes: "Corpo" }),
    }), { params: Promise.resolve({ id: "44" }) })
    expect(res.status).toBe(200)
    expect(prisma.video.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 44 },
      data: { title: "Novo", notes: "Corpo" },
    }))
  })

  it("still rejects YouTube videos", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findUnique.mockResolvedValue({ source: "youtube", userId: 1 })
    const { PATCH } = await import("@/app/api/admin/videos/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/videos/8", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Novo" }),
    }), { params: Promise.resolve({ id: "8" }) })
    expect(res.status).toBe(404)
  })
})
