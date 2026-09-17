import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const prisma = {
  course: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  courseModule: { deleteMany: vi.fn(), create: vi.fn() },
  courseLesson: { findMany: vi.fn() },
  video: { findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("PUT /api/admin/courses/[id]/curriculum", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    prisma.course.findUnique.mockReset()
    prisma.course.findUniqueOrThrow.mockReset()
    prisma.courseModule.deleteMany.mockReset()
    prisma.courseModule.create.mockReset()
    prisma.video.findMany.mockReset()
    prisma.video.updateMany.mockReset()
    prisma.courseLesson.findMany.mockReset()
    prisma.$transaction.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { PUT } = await import("@/app/api/admin/courses/[id]/curriculum/route")
    const res = await PUT(new NextRequest("http://localhost/api/admin/courses/4/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: [] }),
    }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(403)
  })

  it("rejects a video that already belongs to another course", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte", requiredPlan: "premium" })
    prisma.video.findMany.mockResolvedValue([{ id: 11 }])
    prisma.courseLesson.findMany.mockResolvedValue([{ videoId: 11 }])
    const { PUT } = await import("@/app/api/admin/courses/[id]/curriculum/route")
    const res = await PUT(new NextRequest("http://localhost/api/admin/courses/4/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: [{ title: "Módulo 1", lessons: [{ videoId: 11 }] }] }),
    }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(409)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects the same lesson twice in one payload", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte", requiredPlan: "premium" })
    const { PUT } = await import("@/app/api/admin/courses/[id]/curriculum/route")
    const res = await PUT(new NextRequest("http://localhost/api/admin/courses/4/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modules: [{ title: "Módulo 1", lessons: [{ videoId: 11 }, { videoId: 11 }] }],
      }),
    }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "A mesma aula não pode entrar duas vezes no curso" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a lesson that does not exist", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte", requiredPlan: "premium" })
    prisma.video.findMany.mockResolvedValue([])
    const { PUT } = await import("@/app/api/admin/courses/[id]/curriculum/route")
    const res = await PUT(new NextRequest("http://localhost/api/admin/courses/4/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: [{ title: "Módulo 1", lessons: [{ videoId: 11 }] }] }),
    }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Uma das aulas escolhidas não existe" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("replaces the curriculum and writes audit", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.findUnique.mockResolvedValue({ id: 4, title: "Corte", requiredPlan: "premium" })
    prisma.video.findMany.mockResolvedValue([{ id: 11 }])
    prisma.courseLesson.findMany.mockResolvedValue([])
    prisma.courseModule.deleteMany.mockResolvedValue({ count: 1 })
    prisma.courseModule.create.mockResolvedValue({})
    prisma.course.findUniqueOrThrow.mockResolvedValue({
      id: 4,
      title: "Corte",
      modules: [{ title: "Início", lessons: [{ videoId: 11 }] }],
    })
    prisma.video.updateMany.mockResolvedValue({ count: 1 })
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma))
    const { PUT } = await import("@/app/api/admin/courses/[id]/curriculum/route")
    const res = await PUT(new NextRequest("http://localhost/api/admin/courses/4/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules: [{ title: "Início", lessons: [{ videoId: 11 }] }] }),
    }), { params: Promise.resolve({ id: "4" }) })
    expect(res.status).toBe(200)
    expect(prisma.video.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11] }, published: false },
      data: { published: true, requiredPlan: "premium" },
    })
    expect(prisma.courseModule.deleteMany).toHaveBeenCalledWith({ where: { courseId: 4 } })
    expect(prisma.courseModule.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        courseId: 4,
        title: "Início",
        sortOrder: 0,
        lessons: { create: [{ videoId: 11, sortOrder: 0 }] },
      }),
    }))
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "course.update",
      targetId: 4,
      meta: expect.objectContaining({ curriculum: true, modules: 1 }),
    }))
  })
})
