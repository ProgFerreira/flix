import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const prisma = {
  video: { findMany: vi.fn() },
}

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/admin/courses/videos", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    prisma.video.findMany.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { GET } = await import("@/app/api/admin/courses/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses/videos"))
    expect(res.status).toBe(403)
    expect(prisma.video.findMany).not.toHaveBeenCalled()
  })

  it("marks videos already in the current course", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.video.findMany.mockResolvedValue([
      {
        id: 11,
        title: "Aula 1",
        thumbnail: "t.jpg",
        duration: "10:00",
        channelName: "Canal",
        source: "youtube",
        published: true,
        requiredPlan: "free",
        status: "ready",
        courseLesson: null,
      },
      {
        id: 12,
        title: "Aula 2",
        thumbnail: "t.jpg",
        duration: null,
        channelName: null,
        source: "upload",
        published: false,
        requiredPlan: "free",
        status: "ready",
        courseLesson: { module: { courseId: 4 } },
      },
    ])
    const { GET } = await import("@/app/api/admin/courses/videos/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/courses/videos?courseId=4&q=aula"))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items).toEqual([
      expect.objectContaining({ id: 11, inThisCourse: false }),
      expect.objectContaining({ id: 12, inThisCourse: true }),
    ])
    expect(prisma.video.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { source: { in: ["youtube", "upload"] } },
          { title: { contains: "aula" } },
        ]),
      }),
    }))
  })
})
