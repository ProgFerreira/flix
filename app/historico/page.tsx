"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { CheckCircle2, Play, Clock } from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"
import { usePlayer } from "@/app/contexts/PlayerContext"

type VideoCategory = { category: { id: number; name: string; color: string } }
type Video = {
  id: number; title: string; thumbnail: string; videoId: string
  channelName?: string | null; duration?: string | null
  watchedAt?: string | null; videoCategories: VideoCategory[]
}
type Group = { label: string; videos: Video[] }

function groupByDate(videos: Video[]): Group[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, Video[]> = { Hoje: [], Ontem: [], "Esta semana": [], "Mais antigos": [] }
  for (const v of videos) {
    if (!v.watchedAt) continue
    const d = new Date(v.watchedAt)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today) groups["Hoje"].push(v)
    else if (day >= yesterday) groups["Ontem"].push(v)
    else if (day >= weekAgo) groups["Esta semana"].push(v)
    else groups["Mais antigos"].push(v)
  }
  return Object.entries(groups).filter(([, vs]) => vs.length > 0).map(([label, vs]) => ({ label, videos: vs }))
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

export default function HistoricoPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const { play: playVideo } = usePlayer()

  useEffect(() => {
    fetch("/api/videos?status=watched&order=newest")
      .then(r => r.json())
      .then((data: Video[]) => {
        const sorted = Array.isArray(data)
          ? data.filter(v => v.watchedAt).sort((a, b) => new Date(b.watchedAt!).getTime() - new Date(a.watchedAt!).getTime())
          : []
        setVideos(sorted)
      })
      .finally(() => setLoading(false))
  }, [])

  const groups = groupByDate(videos)

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh" }}>
      <AppHeader />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", letterSpacing: "-0.3px" }}>Histórico</h1>
          {!loading && videos.length > 0 && (
            <p style={{ fontSize: 13, color: "#71717a", marginTop: 4 }}>{videos.length} vídeo{videos.length !== 1 ? "s" : ""} assistido{videos.length !== 1 ? "s" : ""}</p>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ borderRadius: 10, height: 72 }} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#a1a1aa", background: "#fff", borderRadius: 12, border: "1px solid #e4e4e7" }}>
            <CheckCircle2 size={44} style={{ margin: "0 auto 14px", opacity: 0.25 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#71717a", marginBottom: 6 }}>Nenhum vídeo assistido ainda</p>
            <p style={{ fontSize: 13 }}>Marque vídeos como assistidos na página principal para vê-los aqui</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase" }}>{group.label}</span>
                <div style={{ flex: 1, height: 1, background: "#e4e4e7" }} />
                <span style={{ fontSize: 11, color: "#a1a1aa" }}>{group.videos.length} vídeo{group.videos.length !== 1 ? "s" : ""}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.videos.map(video => (
                  <VideoRow key={video.id} video={video} onWatch={() => playVideo(video)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

function VideoRow({ video, onWatch }: { video: Video; onWatch: () => void }) {
  const [hover, setHover] = useState(false)

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #e4e4e7", background: "#fff", boxShadow: hover ? "0 2px 8px rgba(0,0,0,0.07)" : "none", transition: "box-shadow 0.15s", cursor: "pointer" }}
      onClick={onWatch}>

      {/* Thumbnail */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Image src={video.thumbnail} alt={video.title} width={96} height={54} style={{ borderRadius: 6, objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e85d04", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={12} fill="#fff" color="#fff" style={{ marginLeft: 2 }} />
          </div>
        </div>
        {video.duration && (
          <span style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3 }}>{video.duration}</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#18181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{video.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {video.channelName && <span style={{ fontSize: 12, color: "#71717a" }}>{video.channelName}</span>}
          {video.videoCategories.map(vc => (
            <span key={vc.category.id} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10, background: vc.category.color + "20", color: vc.category.color }}>{vc.category.name}</span>
          ))}
        </div>
      </div>

      {/* Watched time */}
      {video.watchedAt && (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#16a34a", justifyContent: "flex-end", marginBottom: 2 }}>
            <CheckCircle2 size={11} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Assistido</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#a1a1aa", justifyContent: "flex-end" }}>
            <Clock size={10} />
            <span style={{ fontSize: 11 }}>{formatDate(video.watchedAt)} · {formatTime(video.watchedAt)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
