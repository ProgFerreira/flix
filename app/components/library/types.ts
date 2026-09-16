export type Category = { id: number; name: string; color: string; _count?: { videoCategories: number } }
export type VideoCategory = { category: Category }
export type Video = {
  id: number; url: string; videoId: string; title: string; thumbnail: string
  duration?: string | null; channelName?: string | null; watched: boolean
  favorite: boolean; notes?: string | null; createdAt: string; sortOrder: number
  videoCategories: VideoCategory[]
  permission?: string
  sharedBy?: { id: number; email: string; name?: string | null }
}
export type ShareEntry = { id: number; permission: string; to: { id: number; email: string; name?: string | null } }
export type CollectionMember = { userId: number; role: string; user: { id: number; email: string; name?: string | null } }
export type Collection = {
  id: number; name: string; ownerId: number; myRole: string
  isPublic?: boolean
  shareToken?: string | null
  owner: { id: number; email: string; name?: string | null }
  members: CollectionMember[]
  _count: { videos: number }
}
export type ActiveFilter = "all" | "unwatched" | "watched" | "favorites" | "shared" | number

export const PALETTE = ["#F97316","#2563eb","#16a34a","#7c3aed","#db2777","#0891b2","#f59e0b","#65a30d"]
