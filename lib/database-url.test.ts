import { afterEach, describe, expect, it } from "vitest"
import { applyDatabaseUrlFromEnv, normalizeDatabaseUrl } from "@/lib/database-url"

const original = { ...process.env }

afterEach(() => {
  process.env.DATABASE_URL = original.DATABASE_URL
  process.env.DB_HOST = original.DB_HOST
  process.env.DB_USER = original.DB_USER
  process.env.DB_PASSWORD = original.DB_PASSWORD
  process.env.DB_NAME = original.DB_NAME
  process.env.NODE_ENV = original.NODE_ENV
})

describe("normalizeDatabaseUrl", () => {
  it("encodes @ and $ in the password", () => {
    const url = normalizeDatabaseUrl(
      "mysql://u_flix:Y9n@dT4a$V@auth-db1193.hstgr.io:3306/u_flix",
    )
    expect(url).toBe("mysql://u_flix:Y9n%40dT4a%24V@auth-db1193.hstgr.io:3306/u_flix")
  })

  it("rewrites localhost to the Hostinger MySQL host in production", () => {
    const url = normalizeDatabaseUrl(
      "mysql://u_flix:secret@localhost:3306/u_flix",
      { production: true },
    )
    expect(url).toBe("mysql://u_flix:secret@auth-db1193.hstgr.io:3306/u_flix")
  })

  it("keeps localhost in development", () => {
    const url = normalizeDatabaseUrl(
      "mysql://root:@localhost:3306/flix",
      { production: false },
    )
    expect(url).toBe("mysql://root:@localhost:3306/flix")
  })
})

describe("applyDatabaseUrlFromEnv", () => {
  it("builds DATABASE_URL from DB_* when it is missing", () => {
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = "production"
    process.env.DB_HOST = "localhost"
    process.env.DB_USER = "u_flix"
    process.env.DB_PASSWORD = "Y9n@dT4a$V"
    process.env.DB_NAME = "u_flix"
    applyDatabaseUrlFromEnv()
    expect(process.env.DATABASE_URL).toBe(
      "mysql://u_flix:Y9n%40dT4a%24V@auth-db1193.hstgr.io:3306/u_flix",
    )
  })
})
