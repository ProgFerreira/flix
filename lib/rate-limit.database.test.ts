import { describe, it, expect } from "vitest"
import { randomUUID } from "node:crypto"
import { checkRateLimit } from "./rate-limit"
import { prisma } from "./prisma"

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")("rate limit with concurrent MySQL connections", () => {
  it("allows exactly the configured limit under concurrent requests, and resets the window", async () => {
    const key = `test-rate:${randomUUID()}`
    const now = Date.now()
    try {
      const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key, 5, 60_000, now)))
      expect(results.filter(result => result.allowed)).toHaveLength(5)
      expect((await prisma.rateLimitBucket.findUniqueOrThrow({ where: { chave: key } })).count).toBe(5)
      expect((await checkRateLimit(key, 5, 60_000, now + 60_001)).allowed).toBe(true)
    } finally { await prisma.rateLimitBucket.deleteMany({ where: { chave: key } }); await prisma.$disconnect() }
  })
})
