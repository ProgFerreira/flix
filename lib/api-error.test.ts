import { describe, it, expect } from "vitest"
import { Prisma } from "@prisma/client"
import { handlePrismaError } from "@/lib/api-error"

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "5.22.0" })
}

describe("handlePrismaError", () => {
  it("maps P2002 (unique constraint) to a 409", async () => {
    const res = handlePrismaError(knownError("P2002"))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(409)
    expect((await res!.json()).error).toMatch(/já existe/i)
  })

  it("maps P2025 (record not found) to a 404", async () => {
    const res = handlePrismaError(knownError("P2025"))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)
    expect((await res!.json()).error).toMatch(/não encontrado/i)
  })

  it("returns null for a Prisma error code it doesn't special-case", () => {
    expect(handlePrismaError(knownError("P2001"))).toBeNull()
  })

  it("returns null for a non-Prisma error, so the caller re-throws it", () => {
    expect(handlePrismaError(new Error("something else"))).toBeNull()
    expect(handlePrismaError("not even an error")).toBeNull()
  })

  it("uses a custom duplicate message when provided", async () => {
    const res = handlePrismaError(knownError("P2002"), { duplicate: "Você já tem uma categoria com esse nome" })
    expect((await res!.json()).error).toBe("Você já tem uma categoria com esse nome")
  })

  it("uses a custom not-found message when provided", async () => {
    const res = handlePrismaError(knownError("P2025"), { notFound: "Vídeo não encontrado" })
    expect((await res!.json()).error).toBe("Vídeo não encontrado")
  })

  it("maps P2003 (foreign key constraint) to a 409", async () => {
    const res = handlePrismaError(knownError("P2003"))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(409)
    expect((await res!.json()).error).toMatch(/vinculados/i)
  })

  it("uses a custom referenced message when provided", async () => {
    const res = handlePrismaError(knownError("P2003"), { referenced: "Esse usuário é dono de uma coleção" })
    expect((await res!.json()).error).toBe("Esse usuário é dono de uma coleção")
  })
})
