import { describe, it, expect, vi, beforeEach } from "vitest"
import { GrantLimitError, MAX_VIDEO_GRANTS, parseViewerIdsField, resolveGrantUserIds } from "@/lib/video-grants"

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("parseViewerIdsField", () => {
  it("treats omitted or empty as undefined", () => {
    expect(parseViewerIdsField(undefined)).toEqual({ ok: true, ids: undefined })
    expect(parseViewerIdsField("")).toEqual({ ok: true, ids: undefined })
  })

  it("parses a JSON array of ids", () => {
    expect(parseViewerIdsField("[1,2,3]")).toEqual({ ok: true, ids: [1, 2, 3] })
  })

  it("rejects invalid JSON or non-number arrays", () => {
    expect(parseViewerIdsField("nope")).toEqual({ ok: false, error: "viewerIds inválido" })
    expect(parseViewerIdsField('["a"]')).toEqual({ ok: false, error: "viewerIds inválido" })
  })

  it("rejects more than the max grants", () => {
    const ids = Array.from({ length: MAX_VIDEO_GRANTS + 1 }, (_, i) => i + 1)
    expect(parseViewerIdsField(JSON.stringify(ids))).toEqual({ ok: false, error: "viewerIds inválido" })
  })
})

describe("resolveGrantUserIds", () => {
  beforeEach(() => {
    prisma.user.findMany.mockReset()
  })

  it("drops the owner, duplicates and non-active users", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 2 }, { id: 4 }])
    const ids = await resolveGrantUserIds(prisma as never, [1, 2, 2, 3, 4], 1)
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 3, 4] }, status: "active", deletadoEm: null },
      select: { id: true },
    })
    expect(ids).toEqual([2, 4])
  })

  it("throws when more unique extras than the cap", async () => {
    const ids = Array.from({ length: MAX_VIDEO_GRANTS + 1 }, (_, i) => i + 2)
    await expect(resolveGrantUserIds(prisma as never, ids, 1)).rejects.toBeInstanceOf(GrantLimitError)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })
})
