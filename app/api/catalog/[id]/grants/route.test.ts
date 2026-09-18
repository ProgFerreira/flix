import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const loadManagedCatalogVideo = vi.fn()
const listVideoGrants = vi.fn()
const replaceVideoGrants = vi.fn()

const prisma = {
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  videoAccessGrant: { deleteMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    loadManagedCatalogVideo: (...args: unknown[]) => loadManagedCatalogVideo(...args),
    listVideoGrants: (...args: unknown[]) => listVideoGrants(...args),
    replaceVideoGrants: (...args: unknown[]) => replaceVideoGrants(...args),
  }
})

describe("catalog grants API", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    loadManagedCatalogVideo.mockReset()
    listVideoGrants.mockReset()
    replaceVideoGrants.mockReset()
    prisma.videoAccessGrant.deleteMany.mockReset()
  })

  it("GET returns 403 when the requester is not admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/catalog/[id]/grants/route")
    const res = await GET(new NextRequest("http://localhost/api/catalog/9/grants"), { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(403)
    expect(loadManagedCatalogVideo).not.toHaveBeenCalled()
  })

  it("PUT replaces the extra viewers and audits", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    loadManagedCatalogVideo.mockResolvedValue({ video: { id: 9, userId: 1 } })
    listVideoGrants.mockResolvedValue([{ id: 4, name: "Ana", email: "ana@x.com", plan: "free" }])
    const { PUT } = await import("@/app/api/catalog/[id]/grants/route")
    const res = await PUT(
      new NextRequest("http://localhost/api/catalog/9/grants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerIds: [4] }),
      }),
      { params: Promise.resolve({ id: "9" }) },
    )
    expect(res.status).toBe(200)
    expect(replaceVideoGrants).toHaveBeenCalledWith({}, {
      videoId: 9,
      userIds: [4],
      grantedBy: 1,
      ownerId: 1,
    })
    expect(await res.json()).toEqual([{ id: 4, name: "Ana", email: "ana@x.com", plan: "free" }])
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      adminId: 1,
      action: "video.update",
      targetType: "video",
      targetId: 9,
    }))
  })

  it("DELETE returns 403 when the requester is not admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { DELETE } = await import("@/app/api/catalog/[id]/grants/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/catalog/9/grants?userId=4", { method: "DELETE" }),
      { params: Promise.resolve({ id: "9" }) },
    )
    expect(res.status).toBe(403)
    expect(prisma.videoAccessGrant.deleteMany).not.toHaveBeenCalled()
  })
})
