import crypto from "crypto"

export const SHARE_TOKEN_BYTES = 24
export const SHARE_TOKEN_MAX = 64

export function newShareToken(): string {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString("base64url")
}

export function isShareToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(raw)
}

export type PublicCollectionVideo = {
  videoId: string
  title: string
  thumbnail: string
  duration: string | null
  channelName: string | null
  source: "youtube"
}

export type PublicCollectionPayload = {
  name: string
  ownerName: string
  videos: PublicCollectionVideo[]
}

type VideoRow = {
  title: string
  thumbnail: string
  duration: string | null
  channelName: string | null
  source: string
  videoId: string | null
}

/** Só YouTube entra no link público — upload autoral continua atrás de conta/plano. */
export function toPublicCollection(
  name: string,
  ownerName: string | null | undefined,
  videos: VideoRow[],
): PublicCollectionPayload {
  return {
    name,
    ownerName: ownerName?.trim() || "Alguém no GEFlix",
    videos: videos.flatMap((v) => {
      if (v.source !== "youtube" || !v.videoId) return []
      return [{
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.duration,
        channelName: v.channelName,
        source: "youtube" as const,
      }]
    }),
  }
}

export function collectionForMember<T extends { shareToken?: string | null; members: { userId: number; role: string }[] }>(
  collection: T,
  userId: number,
) {
  const myRole = collection.members.find((m) => m.userId === userId)?.role ?? "viewer"
  return {
    ...collection,
    myRole,
    shareToken: myRole === "owner" ? collection.shareToken ?? null : null,
  }
}
