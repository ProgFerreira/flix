import { describe, it, expect } from "vitest"
import { canAccessCatalogVideo } from "@/lib/session"
import {
  isContinueWatching,
  continueProgressPercent,
  remainingLabel,
  selectContinueWatching,
  CONTINUE_MIN_SECONDS,
  type ContinueVideo,
} from "@/lib/watch-continue"

function video(over: Partial<ContinueVideo> = {}): ContinueVideo {
  return {
    id: 1,
    title: "Aula 1",
    thumbnail: "t.jpg",
    duration: "10:00",
    channelName: "Canal",
    source: "upload",
    videoId: null,
    requiredPlan: "free",
    published: true,
    userId: 9,
    ...over,
  }
}

describe("isContinueWatching", () => {
  it("rejects progress below the resume threshold", () => {
    expect(isContinueWatching(CONTINUE_MIN_SECONDS - 1, "10:00")).toBe(false)
    expect(isContinueWatching(CONTINUE_MIN_SECONDS, "10:00")).toBe(true)
  })

  it("treats ~90% as finished when duration is known", () => {
    expect(isContinueWatching(540, "10:00")).toBe(false)
    expect(isContinueWatching(500, "10:00")).toBe(true)
  })

  it("keeps items without duration if they passed the threshold", () => {
    expect(isContinueWatching(30, null)).toBe(true)
  })
})

describe("continueProgressPercent", () => {
  it("clamps between 1 and 99", () => {
    expect(continueProgressPercent(1, "10:00")).toBe(1)
    expect(continueProgressPercent(599, "10:00")).toBe(99)
  })

  it("returns null without a usable duration", () => {
    expect(continueProgressPercent(40, null)).toBeNull()
    expect(continueProgressPercent(0, "10:00")).toBeNull()
  })
})

describe("remainingLabel", () => {
  it("formats minutes left", () => {
    expect(remainingLabel(120, "10:00")).toBe("8 min restantes")
    expect(remainingLabel(540, "10:00")).toBe("1 min restante")
    expect(remainingLabel(580, "10:00")).toBe("Menos de 1 min")
  })

  it("falls back when duration is unknown", () => {
    expect(remainingLabel(40, null)).toBe("Continuar")
  })
})

describe("selectContinueWatching", () => {
  function accessFor(grantIds: Set<number> = new Set()) {
    return {
      userId: 5,
      canAccess: (video: ContinueVideo) => canAccessCatalogVideo({
        isOwner: video.userId === 5,
        isAdmin: false,
        published: video.published,
        requiredPlan: video.requiredPlan,
        requesterPlan: "free",
        isGranted: grantIds.has(video.id),
      }),
    }
  }
  const access = accessFor()

  it("drops finished, locked and unpublished (for non-owners)", () => {
    const items = selectContinueWatching(
      [
        { seconds: 40, video: video({ id: 1, duration: "10:00" }) },
        { seconds: 580, video: video({ id: 2, duration: "10:00" }) },
        { seconds: 40, video: video({ id: 3, requiredPlan: "premium" }) },
        { seconds: 40, video: video({ id: 4, published: false }) },
        { seconds: 3, video: video({ id: 5 }) },
      ],
      access,
    )
    expect(items.map((x) => x.id)).toEqual([1])
    expect(items[0].locked).toBe(false)
    expect(items[0].progressSeconds).toBe(40)
    expect(items[0].qualities).toEqual(["source"])
  })

  it("exposes 480p when the upload has a preview variant", () => {
    const items = selectContinueWatching(
      [{ seconds: 40, video: video({ id: 1, previewPath: "low.mp4" }) }],
      access,
    )
    expect(items[0].qualities).toEqual(["480", "source"])
  })

  it("keeps a granted premium video and an unpublished own draft", () => {
    const items = selectContinueWatching(
      [
        { seconds: 40, video: video({ id: 3, requiredPlan: "premium" }) },
        { seconds: 40, video: video({ id: 8, published: false, userId: 5 }) },
      ],
      accessFor(new Set([3])),
    )
    expect(items.map((x) => x.id)).toEqual([3, 8])
    expect(items[1].mine).toBe(true)
  })

  it("preserves updatedAt order and caps the rail", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      seconds: 40,
      video: video({ id: i + 1 }),
    }))
    expect(selectContinueWatching(rows, access)).toHaveLength(12)
    expect(selectContinueWatching(rows, access)[0].id).toBe(1)
  })
})
