import { describe, expect, it } from "vitest"
import { missingRequiredProdEnv } from "./required-prod-env.mjs"

describe("missingRequiredProdEnv", () => {
  it("lists every required key when the env is empty", () => {
    expect(missingRequiredProdEnv({})).toEqual([
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
    ])
  })

  it("treats blank values as missing", () => {
    expect(
      missingRequiredProdEnv({
        DATABASE_URL: "mysql://root:@localhost:3306/flix",
        NEXTAUTH_SECRET: "   ",
        NEXTAUTH_URL: "https://example.com",
      }),
    ).toEqual(["NEXTAUTH_SECRET"])
  })

  it("returns nothing when all required keys are set", () => {
    expect(
      missingRequiredProdEnv({
        DATABASE_URL: "mysql://root:@localhost:3306/flix",
        NEXTAUTH_SECRET: "secret",
        NEXTAUTH_URL: "https://example.com",
      }),
    ).toEqual([])
  })
})
