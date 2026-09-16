import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const allocateCourseSlug = vi.fn()

const prisma = {
  course: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  courseModule: { deleteMany: vi.fn(), create: vi.fn() },
  courseLesson: { findMany: vi.fn() },
  video: { findMany: vi.fn() },
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

describe("GET /api/admin/courses", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.course.count.mockReset()
    prisma.course.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/courses/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses"))
    expect(res.status).toBe(403)
  })

  it("lists courses with lesson counts", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.course.count.mockResolvedValue(1)
    prisma.course.findMany.mockResolvedValue([{
      id: 9,
      title: "Corte",
      slug: "corte",
      requiredPlan: "free",
      published: true,
      modules: [{ _count: { lessons: 2 } }, { _count: { lessons: 1 } }],
    }])
    const { GET } = await import("@/app/api/admin/courses/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items[0].lessonCount).toBe(3)
    expect(json.items[0].moduleCount).toBe(2)
  })
})

describe("POST /api/admin/courses", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    allocateCourseSlug.mockReset()
    prisma.course.create.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/courses/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Corte" }),
    }))
    expect(res.status).toBe(403)
    expect(prisma.course.create).not.toHaveBeenCalled()
  })

  it("returns 400 when title is missing", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    const { POST } = await import("@/app/api/admin/courses/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
    expect(prisma.course.create).not.toHaveBeenCalled()
  })

  it("creates a course and writes audit", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    allocateCourseSlug.mockResolvedValue("corte")
    prisma.course.create.mockResolvedValue({ id: 4, title: "Corte", slug: "corte" })
    const { POST } = await import("@/app/api/admin/courses/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Corte" }),
    }))
    expect(res.status).toBe(201)
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "course.create",
      targetType: "course",
      targetId: 4,
    }))
  })
})
