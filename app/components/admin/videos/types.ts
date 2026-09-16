export type Category = { id: number; name: string; color: string }
export type AdminVideo = {
  id: number
  title: string
  thumbnail: string
  channelName?: string | null
  notes?: string | null
  requiredPlan: string
  published: boolean
  status: string
  qualities?: string[]
  processError?: string | null
  fileSize?: number | string | null
  createdAt: string
  videoCategories: { category: Category }[]
}

export const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

export function fmtSize(bytes?: number | string | bigint | null) {
  if (bytes == null || bytes === "") return "—"
  const n = typeof bytes === "bigint" ? Number(bytes) : Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return "—"
  const mb = n / 1024 / 1024
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}
