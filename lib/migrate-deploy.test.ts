import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { prismaMigrateArgs, projectRootWithPrisma } from "@/lib/migrate-deploy"

describe("prismaMigrateArgs", () => {
  it("runs Prisma via the Node binary, never npx", () => {
    const { cmd, args } = prismaMigrateArgs()
    expect(cmd).toBe(process.execPath)
    expect(args[0]).toMatch(/prisma[/\\]build[/\\]index\.js$/)
    expect(existsSync(args[0])).toBe(true)
    expect(args.slice(1)).toEqual(["migrate", "deploy"])
    expect(cmd).not.toMatch(/npx/)
  })
})

describe("projectRootWithPrisma", () => {
  it("finds prisma/schema.prisma from the repo root", () => {
    const root = projectRootWithPrisma()
    expect(existsSync(path.join(root, "prisma", "schema.prisma"))).toBe(true)
  })
})
