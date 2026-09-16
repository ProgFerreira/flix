import { describe, it, expect, vi, beforeEach } from "vitest"

const prisma = {
  $queryRaw: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma }))

describe("GET /api/health", () => {
  beforeEach(() => {
    prisma.$queryRaw.mockReset()
  })

  it("returns ok when the database answers", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "1": 1 }])
    const { GET } = await import("@/app/api/health/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("ok")
    expect(json.database).toBe("ok")
  })

  it("returns 503 when the database is down", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("down"))
    const { GET } = await import("@/app/api/health/route")
    const res = await GET()
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.status).toBe("degraded")
  })
})
