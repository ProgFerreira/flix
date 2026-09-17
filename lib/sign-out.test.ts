import { beforeEach, describe, expect, it, vi } from "vitest"

const signOut = vi.fn()

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOut(...args),
}))

describe("signOutToLogin", () => {
  const assign = vi.fn()

  beforeEach(() => {
    signOut.mockReset()
    assign.mockReset()
    vi.stubGlobal("window", { location: { assign } })
  })

  it("clears the session without NextAuth navigation, then loads login", async () => {
    signOut.mockResolvedValue(undefined)
    const { signOutToLogin } = await import("./sign-out")
    await signOutToLogin()
    expect(signOut).toHaveBeenCalledWith({ redirect: false, callbackUrl: "/login?returnTo=%2F" })
    expect(assign).toHaveBeenCalledWith("/login?returnTo=%2F")
  })

  it("still loads login if signOut throws", async () => {
    signOut.mockRejectedValue(new Error("not json"))
    const { signOutToLogin } = await import("./sign-out")
    await expect(signOutToLogin()).resolves.toBeUndefined()
    expect(assign).toHaveBeenCalledWith("/login?returnTo=%2F")
  })
})
