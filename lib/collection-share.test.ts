import { describe, it, expect } from "vitest"
import { isShareToken, newShareToken, toPublicCollection, collectionForMember } from "@/lib/collection-share"

describe("newShareToken / isShareToken", () => {
  it("gera token URL-safe e aceito pelo validador", () => {
    const token = newShareToken()
    expect(isShareToken(token)).toBe(true)
    expect(token).not.toMatch(/[+/=]/)
  })

  it("rejeita token curto, com espaços ou path traversal", () => {
    expect(isShareToken("")).toBe(false)
    expect(isShareToken("abc")).toBe(false)
    expect(isShareToken("../etc/passwd")).toBe(false)
    expect(isShareToken("a".repeat(19))).toBe(false)
  })
})

describe("toPublicCollection", () => {
  it("omite upload, notes e videoId vazio", () => {
    const payload = toPublicCollection("Estudos", "Ana", [
      { title: "Aula 1", thumbnail: "t.jpg", duration: "10:00", channelName: "Canal", source: "youtube", videoId: "abcdefghijk" },
      { title: "Arquivo", thumbnail: "x", duration: null, channelName: null, source: "upload", videoId: null },
      { title: "Sem id", thumbnail: "x", duration: null, channelName: null, source: "youtube", videoId: null },
    ])
    expect(payload).toEqual({
      name: "Estudos",
      ownerName: "Ana",
      videos: [{
        videoId: "abcdefghijk",
        title: "Aula 1",
        thumbnail: "t.jpg",
        duration: "10:00",
        channelName: "Canal",
        source: "youtube",
      }],
    })
  })

  it("usa fallback quando o dono não tem nome", () => {
    const payload = toPublicCollection("Lista", "  ", [])
    expect(payload.ownerName).toBe("Alguém no GEFlix")
  })
})

describe("collectionForMember", () => {
  const col = {
    id: 1,
    shareToken: "secret-token-value-ok12",
    members: [
      { userId: 1, role: "owner" },
      { userId: 2, role: "viewer" },
    ],
  }

  it("só o dono recebe o shareToken", () => {
    expect(collectionForMember(col, 1).shareToken).toBe("secret-token-value-ok12")
    expect(collectionForMember(col, 2).shareToken).toBeNull()
  })
})
