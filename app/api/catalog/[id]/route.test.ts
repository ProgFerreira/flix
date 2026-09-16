import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireUserId = vi.fn()
const loadManagedCatalogVideo = vi.fn()
const ownedCategoryIds = vi.fn()
const replaceVideoGrants = vi.fn()
const removeVideoFiles = vi.fn(async () => undefined)

const prisma = {
  $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  video: { update: vi.fn(), delete: vi.fn() },
  videoCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
}

const tx = {
  videoCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
  video: { update: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireUserId: (...args: unknown[]) => requireUserId(...args),
}))

vi.mock("@/lib/video-grants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/video-grants")>()
  return {
    ...actual,
    loadManagedCatalogVideo: (...args: unknown[]) => loadManagedCatalogVideo(...args),
    replaceVideoGrants: (...args: unknown[]) => replaceVideoGrants(...args),
  }
})

vi.mock("@/lib/categories", () => ({
  ownedCategoryIds: (...args: unknown[]) => ownedCategoryIds(...args),
}))

vi.mock("@/lib/video-storage", () => ({
  removeVideoFiles: (...args: unknown[]) => removeVideoFiles(...args),
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

function patch(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/catalog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/catalog/[id]", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    loadManagedCatalogVideo.mockReset()
    ownedCategoryIds.mockReset()
    replaceVideoGrants.mockReset()
    tx.video.update.mockReset()
    tx.videoCategory.deleteMany.mockReset()
    tx.videoCategory.createMany.mockReset()
  })

  it("returns 401 when there is no session", async () => {
    requireUserId.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }))
    const { PATCH } = await import("@/app/api/catalog/[id]/route")
    const res = await PATCH(patch("5", { title: "Novo" }), { params: Promise.resolve({ id: "5" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 for a non-numeric id", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    const { PATCH } = await import("@/app/api/catalog/[id]/route")
    const res = await PATCH(patch("x", { title: "Novo" }), { params: Promise.resolve({ id: "x" }) })
    expect(res.status).toBe(404)
    expect(loadManagedCatalogVideo).not.toHaveBeenCalled()
  })

  it("forwards the managed-video error when the requester cannot edit", async () => {
    requireUserId.mockResolvedValue({ userId: 2 })
    loadManagedCatalogVideo.mockResolvedValue({
      error: NextResponse.json({ error: "Não autorizado" }, { status: 403 }),
    })
    const { PATCH } = await import("@/app/api/catalog/[id]/route")
    const res = await PATCH(patch("5", { title: "Novo" }), { params: Promise.resolve({ id: "5" }) })
    expect(res.status).toBe(403)
  })

  it("updates title and serializes fileSize", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    loadManagedCatalogVideo.mockResolvedValue({ video: { id: 5, userId: 7 } })
    tx.video.update.mockResolvedValue({
      id: 5, title: "Novo", fileSize: 2048n, videoCategories: [],
    })
    const { PATCH } = await import("@/app/api/catalog/[id]/route")
    const res = await PATCH(patch("5", { title: "Novo" }), { params: Promise.resolve({ id: "5" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.title).toBe("Novo")
    expect(json.fileSize).toBe(2048)
  })
})

describe("DELETE /api/catalog/[id]", () => {
  beforeEach(() => {
    requireUserId.mockReset()
    loadManagedCatalogVideo.mockReset()
    prisma.video.delete.mockReset()
    removeVideoFiles.mockReset()
  })

  it("deletes a YouTube item without touching disk", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    loadManagedCatalogVideo.mockResolvedValue({
      video: { id: 5, userId: 7, source: "youtube", filePath: null },
    })
    const { DELETE } = await import("@/app/api/catalog/[id]/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/catalog/5", { method: "DELETE" }),
      { params: Promise.resolve({ id: "5" }) },
    )
    expect(res.status).toBe(200)
    expect(prisma.video.delete).toHaveBeenCalledWith({ where: { id: 5 } })
    expect(removeVideoFiles).not.toHaveBeenCalled()
  })

  it("unlinks the stored file when deleting an upload", async () => {
    requireUserId.mockResolvedValue({ userId: 7 })
    loadManagedCatalogVideo.mockResolvedValue({
      video: { id: 8, userId: 7, source: "upload", filePath: "abc.mp4" },
    })
    const { DELETE } = await import("@/app/api/catalog/[id]/route")
    const res = await DELETE(
      new NextRequest("http://localhost/api/catalog/8", { method: "DELETE" }),
      { params: Promise.resolve({ id: "8" }) },
    )
    expect(res.status).toBe(200)
    expect(removeVideoFiles).toHaveBeenCalledWith({
      id: 8, userId: 7, source: "upload", filePath: "abc.mp4",
    })
  })
})
