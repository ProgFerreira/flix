"use client"

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

export type PlaylistItem = {
  id: number
  videoId?: string | null
  title: string
  channelName?: string | null
  source?: "youtube" | "upload"
  startSeconds?: number
  qualities?: string[]
}

export type WatchVideo = PlaylistItem & {
  playlist?: { items: PlaylistItem[]; index: number }
}

type PlayerContextType = {
  play: (video: WatchVideo) => void
  close: () => void
  current: WatchVideo | null
}

const PlayerContext = createContext<PlayerContextType>({
  play: () => {}, close: () => {}, current: null,
})

export function usePlayer() { return useContext(PlayerContext) }

async function saveProgress(videoId: number, seconds: number) {
  try {
    await fetch(`/api/catalog/${videoId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds: Math.floor(seconds) }),
    })
  } catch {
    // progresso é best-effort
  }
}

function streamSrc(id: number, quality: string) {
  if (quality === "source") return `/api/videos/${id}/stream?quality=source`
  if (quality === "480") return `/api/videos/${id}/stream?quality=480`
  return `/api/videos/${id}/stream`
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<WatchVideo | null>(null)
  const [mini, setMini] = useState(false)
  const [quality, setQuality] = useState("auto")
  const iframeRef = useRef<HTMLIFrameElement | HTMLVideoElement>(null)
  const lastSaved = useRef(0)
  const resumeAt = useRef(0)

  const play = useCallback((v: WatchVideo) => {
    setVideo(v)
    setMini(false)
    lastSaved.current = 0
    resumeAt.current = v.startSeconds ?? 0
    setQuality(v.qualities?.includes("480") ? "480" : "auto")
  }, [])
  const persistProgress = useCallback(() => {
    const el = iframeRef.current
    if (video?.source === "upload" && el && "currentTime" in el) {
      void saveProgress(video.id, (el as HTMLVideoElement).currentTime)
    }
  }, [video])
  const close = useCallback(() => {
    persistProgress()
    setVideo(null); setMini(false)
  }, [persistProgress])
  const skipPlaylist = useCallback((delta: number) => {
    if (!video?.playlist) return
    const index = video.playlist.index + delta
    const item = video.playlist.items[index]
    if (!item) return
    persistProgress()
    play({ ...item, playlist: { items: video.playlist.items, index } })
  }, [play, persistProgress, video])

  const changeQuality = (next: string) => {
    const el = iframeRef.current
    if (el && "currentTime" in el) resumeAt.current = (el as HTMLVideoElement).currentTime
    setQuality(next)
  }

  useEffect(() => {
    if (!video || video.source !== "upload") return
    const el = iframeRef.current as HTMLVideoElement | null
    if (!el) return

    const onLoaded = () => {
      if (resumeAt.current > 3) {
        el.currentTime = resumeAt.current
      }
    }
    const onTime = () => {
      const t = el.currentTime
      if (t - lastSaved.current < 5) return
      lastSaved.current = t
      void saveProgress(video.id, t)
    }
    const onPause = () => { void saveProgress(video.id, el.currentTime) }

    el.addEventListener("loadedmetadata", onLoaded)
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("pause", onPause)
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded)
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("pause", onPause)
    }
  }, [video, quality])

  useEffect(() => {
    if (!video) return
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") close() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [video, close])

  const hasQualitySwitch = Boolean(video?.qualities?.includes("480"))
  const playlistIndex = video?.playlist?.index ?? 0
  const playlistCount = video?.playlist?.items.length ?? 0
  const hasPrev = Boolean(video?.playlist && playlistIndex > 0)
  const hasNext = Boolean(video?.playlist && playlistIndex < playlistCount - 1)

  return (
    <PlayerContext.Provider value={{ play, close, current: video }}>
      {children}

      {video && !mini && (
        <div className="modal-backdrop" style={{ zIndex: 298, background: "rgba(0,0,0,0.6)" }} />
      )}

      {video && (
        <div style={{
          position: "fixed", zIndex: 300,
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          ...(mini ? {
            bottom: 24, right: 24, left: "auto", top: "auto",
            width: 320, transform: "none",
          } : {
            top: "50%", left: "50%",
            width: "min(860px, 92vw)",
            transform: "translate(-50%, -50%)",
          }),
          background: mini ? "#000" : "#fff",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: mini ? "0 8px 32px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.2)",
          border: mini ? "none" : "1px solid #E2E8F0",
        }}>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: mini ? "6px 10px" : "14px 20px 10px", background: mini ? "#0F172A" : "#fff" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: mini ? 11 : 15, fontWeight: 600, color: mini ? "#CBD5E1" : "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {video.title}
              </p>
              {!mini && video.channelName && (
                <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{video.channelName}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
              {!mini && video.playlist && (
                <>
                  <button type="button" className="btn btn-ghost" style={{ padding: "4px 8px" }} aria-label="Aula anterior" disabled={!hasPrev} onClick={() => skipPlaylist(-1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: "4px 8px" }} aria-label="Próxima aula" disabled={!hasNext} onClick={() => skipPlaylist(1)}>
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
              {!mini && hasQualitySwitch && video.source === "upload" && (
                <div className="select-wrap">
                  <select
                    className="select"
                    aria-label="Qualidade"
                    value={quality}
                    onChange={(e) => changeQuality(e.target.value)}
                  >
                    <option value="480">480p</option>
                    <option value="source">Original</option>
                  </select>
                </div>
              )}
              {!mini && (
                <button type="button" className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => iframeRef.current?.requestFullscreen?.()}>
                  Tela cheia
                </button>
              )}
              <button type="button" className="icon-btn" aria-label={mini ? "Expandir player" : "Minimizar player"} title={mini ? "Expandir" : "Minimizar"}
                style={{ background: mini ? "rgba(255,255,255,0.1)" : undefined, color: mini ? "#CBD5E1" : undefined }}
                onClick={() => setMini((p) => !p)}>
                {mini
                  ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 9L2 12L5 12M12 5L12 2L9 2M9 12L12 12L12 9M2 5L2 2L5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 2H2V5M9 2H12V5M5 12H2V9M9 12H12V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              <button type="button" className="icon-btn" aria-label="Fechar player" title="Fechar" onClick={close}
                style={{ background: mini ? "rgba(255,255,255,0.1)" : undefined, color: mini ? "#CBD5E1" : undefined }}>
                <X size={mini ? 13 : 16} />
              </button>
            </div>
          </div>

          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            {video.source === "upload" ? (
              <video
                ref={iframeRef as React.RefObject<HTMLVideoElement>}
                key={`${video.id}-${quality}`}
                src={streamSrc(video.id, quality)}
                controls
                autoPlay
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
              />
            ) : (
              <iframe
                title={video.title}
                ref={iframeRef as React.RefObject<HTMLIFrameElement>}
                key={video.videoId}
                src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1${video.startSeconds && video.startSeconds > 3 ? `&start=${Math.floor(video.startSeconds)}` : ""}`}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  )
}
