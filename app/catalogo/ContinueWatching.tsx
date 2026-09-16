"use client"

import { useQuery } from "@tanstack/react-query"
import { VideoThumb } from "@/app/components/VideoThumb"
import { Play } from "lucide-react"

export type ContinueItem = {
  id: number
  title: string
  thumbnail: string
  duration?: string | null
  channelName?: string | null
  source: "youtube" | "upload"
  videoId?: string | null
  progressSeconds: number
  progressPercent: number | null
  remainingLabel: string
  qualities?: string[]
}

export function ContinueWatching({
  onWatch,
}: {
  onWatch: (v: ContinueItem) => void
}) {
  const query = useQuery({
    queryKey: ["catalog-continue"],
    queryFn: async () => {
      const res = await fetch("/api/catalog/continue")
      if (!res.ok) throw new Error("Falha ao carregar continuar assistindo")
      return res.json() as Promise<{ items: ContinueItem[] }>
    },
  })

  const items = Array.isArray(query.data?.items) ? query.data.items : []
  if (items.length === 0) return null

  return (
    <section className="catalog-continue" aria-label="Continuar assistindo">
      <p className="kicker">Continuar assistindo</p>
      <div className="catalog-rail">
        {items.map((v) => (
          <div key={v.id} className="video-card catalog-rail-card">
            <div
              className="video-card-thumb"
              role="button"
              tabIndex={0}
              aria-label={`Continuar ${v.title}`}
              onClick={() => onWatch(v)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch(v) } }}
            >
              <VideoThumb src={v.thumbnail} alt={v.title} sizes="220px" />
              <div className="thumb-center">
                <div className="play-btn"><Play size={18} fill="#fff" color="#fff" /></div>
              </div>
              {v.duration && <span className="thumb-time">{v.duration}</span>}
              {v.progressPercent != null && (
                <div className="thumb-progress" aria-hidden="true">
                  <span style={{ ["--bar-pct" as string]: `${v.progressPercent}%` }} />
                </div>
              )}
            </div>
            <div className="video-card-body">
              <h3 className="video-card-title" title={v.title}>
                {v.title.length > 48 ? v.title.slice(0, 48) + "…" : v.title}
              </h3>
              <div className="video-card-meta">
                {v.channelName && <span className="video-card-channel">{v.channelName}</span>}
                <span className="muted-2">{v.remainingLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
