"use client"

import { useState } from "react"
import Image from "next/image"
import { CheckCircle2, Play, Clock } from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"
import { Pager } from "@/app/components/Pager"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { useRequireAuth } from "@/app/components/useRequireAuth"
import { useQuery } from "@tanstack/react-query"

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
  const status = useRequireAuth()
  const [page, setPage] = useState(1)
  const { play: playVideo } = usePlayer()

  const histQuery = useQuery({
    queryKey: ["history", page],
    queryFn: async () => {
      const r = await fetch(`/api/videos?status=watched&order=newest&page=${page}`)
      return r.json()
    },
    enabled: status === "authenticated",
  })
  const videos = itemsFromPaginated<Video>(histQuery.data)
    .filter(v => v.watchedAt)
    .sort((a, b) => new Date(b.watchedAt!).getTime() - new Date(a.watchedAt!).getTime())
  const meta = pageMeta(histQuery.data)
  const loading = histQuery.isLoading

  if (status === "loading" || status === "unauthenticated") {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  const groups = groupByDate(videos)

  return (
    <div className="page">
      <AppHeader />

      <main id="conteudo" className="page-wrap page-wrap--narrow">
        <div className="mb-section">
          <h1 className="page-title">Histórico</h1>
          {!loading && meta.total > 0 && (
            <p className="page-sub">{meta.total} vídeo{meta.total !== 1 ? "s" : ""} assistido{meta.total !== 1 ? "s" : ""}</p>
          )}
        </div>

        {loading ? (
          <div className="history-list">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton skeleton-row" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="empty empty-card">
            <CheckCircle2 size={44} className="empty-icon" />
            <p>Nenhum vídeo assistido ainda</p>
            <p className="page-sub">Marque vídeos como assistidos na página principal para vê-los aqui</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="history-group">
              <div className="history-label">
                <span>{group.label}</span>
                <hr />
                <span className="text-xs">{group.videos.length} vídeo{group.videos.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="history-list">
                {group.videos.map(video => (
                  <VideoRow key={video.id} video={video} onWatch={() => playVideo(video)} />
                ))}
              </div>
            </div>
          ))
        )}
        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>
    </div>
  )
}

function VideoRow({ video, onWatch }: { video: Video; onWatch: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Assistir ${video.title}`}
      className="history-row"
      onClick={onWatch}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch() } }}
    >
      <div className="history-thumb">
        <Image src={video.thumbnail} alt={video.title} width={96} height={54} style={{ objectFit: "cover" }} />
        <div className="video-card-overlay">
          <div className="play-btn play-btn--sm"><Play size={12} fill="#fff" color="#fff" /></div>
        </div>
        {video.duration && <span className="thumb-time">{video.duration}</span>}
      </div>

      <div className="history-body">
        <p className="history-title">{video.title}</p>
        <div className="history-meta">
          {video.channelName && <span className="muted-2">{video.channelName}</span>}
          {video.videoCategories.map(vc => (
            <span key={vc.category.id} className="cat-tag" style={{ ["--chip-color" as string]: vc.category.color }}>{vc.category.name}</span>
          ))}
        </div>
      </div>

      {video.watchedAt && (
        <div className="history-when">
          <div className="is-ok"><CheckCircle2 size={11} /> Assistido</div>
          <div className="when"><Clock size={10} /> {formatDate(video.watchedAt)} · {formatTime(video.watchedAt)}</div>
        </div>
      )}
    </div>
  )
}
