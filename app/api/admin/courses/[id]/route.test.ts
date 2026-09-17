import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const allocateCourseSlug = vi.fn()
const prisma = {
  course: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  courseModule: { deleteMany: vi.fn(), create: vi.fn() },
  courseLesson: { findMany: vi.fn() },
  video: { findMany: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/course-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/course-query")>()
  return {
    ...actual,
    allocateCourseSlug: (...args: unknown[]) => allocateCourseSlug(...args),
  }
})

const params = { params: Promise.resolve({ id: "4" }) }

describe("GET /api/admin/courses/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.course.findUnique.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/courses/[id]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses/4"), params)
    expect(res.status).toBe(403)
  })

  it("returns 404 for an invalid id", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { GET } = await import("@/app/api/admin/courses/[id]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses/abc"), {
      params: Promise.resolve({ id: "abc" }),
    })
    expect(res.status).toBe(404)
    expect(prisma.course.findUnique).not.toHaveBeenCalled()
  })

  it("returns the course with curriculum", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte", modules: [] })
    const { GET } = await import("@/app/api/admin/courses/[id]/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses/4"), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 4, title: "Corte", modules: [] })
  })
})

describe("PATCH /api/admin/courses/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    allocateCourseSlug.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.course.update.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { PATCH } = await import("@/app/api/admin/courses/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/courses/4", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Novo" }),
    }), params)
    expect(res.status).toBe(403)
    expect(prisma.course.update).not.toHaveBeenCalled()
  })

  it("rejects an invalid thumbnail", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { PATCH } = await import("@/app/api/admin/courses/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/courses/4", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail: "capa.png" }),
    }), params)
    expect(res.status).toBe(400)
    expect(prisma.course.update).not.toHaveBeenCalled()
  })

  it("updates metadata and writes audit", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte" })
    allocateCourseSlug.mockResolvedValue("trilha-corte")
    prisma.course.update.mockResolvedValue({
      id: 4,
      title: "Trilha de corte",
      slug: "trilha-corte",
      published: true,
    })
    const { PATCH } = await import("@/app/api/admin/courses/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/courses/4", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Trilha de corte",
        slug: "trilha-corte",
        published: true,
        requiredPlan: "premium",
      }),
    }), params)
    expect(res.status).toBe(200)
    expect(allocateCourseSlug).toHaveBeenCalledWith("Trilha de corte", "trilha-corte", 4)
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "course.update",
      targetType: "course",
      targetId: 4,
    }))
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: expect.objectContaining({ published: true, requiredPlan: "premium", title: "Trilha de corte" }),
    })
  })

  it("publishes a course with only the published flag", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Vendas" })
    prisma.course.update.mockResolvedValue({ id: 4, title: "Vendas", published: true })
    const { PATCH } = await import("@/app/api/admin/courses/[id]/route")
    const res = await PATCH(new NextRequest("http://localhost/api/admin/courses/4", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: true }),
    }), params)
    expect(res.status).toBe(200)
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { published: true },
    })
  })
})

describe("DELETE /api/admin/courses/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    prisma.course.delete.mockReset()
    prisma.video.delete.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { DELETE } = await import("@/app/api/admin/courses/[id]/route")
    const res = await DELETE(new NextRequest("http://localhost/api/admin/courses/4", { method: "DELETE" }), {
      params: Promise.resolve({ id: "4" }),
    })
    expect(res.status).toBe(403)
  })

  it("deletes the course without deleting videos", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.delete.mockResolvedValue({ id: 4, title: "Corte", slug: "corte" })
    const { DELETE } = await import("@/app/api/admin/courses/[id]/route")
    const res = await DELETE(new NextRequest("http://localhost/api/admin/courses/4", { method: "DELETE" }), {
      params: Promise.resolve({ id: "4" }),
    })
    expect(res.status).toBe(200)
    expect(prisma.course.delete).toHaveBeenCalledWith({
      where: { id: 4 },
      select: { id: true, title: true, slug: true },
    })
    expect(prisma.video.delete).not.toHaveBeenCalled()
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "course.delete", targetId: 4 }))
  })
})
