"use client"

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react"
import { X } from "lucide-react"

type WatchVideo = {
  id: number; videoId?: string | null; title: string; channelName?: string | null
  source?: "youtube" | "upload"
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

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<WatchVideo | null>(null)
  const [mini, setMini] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | HTMLVideoElement>(null)

  const play = useCallback((v: WatchVideo) => { setVideo(v); setMini(false) }, [])
  const close = useCallback(() => { setVideo(null); setMini(false) }, [])

  return (
    <PlayerContext.Provider value={{ play, close, current: video }}>
      {children}

      {/* Backdrop — só no modo cheio */}
      {video && !mini && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", zIndex: 298 }} />
      )}

      {/* Player — único iframe, nunca desmonta enquanto video estiver aberto */}
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

          {/* Controles */}
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
              {!mini && (
                <button onClick={() => iframeRef.current?.requestFullscreen?.()} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 6, color: "#475569", cursor: "pointer", padding: "4px 10px", fontSize: 12 }}>
                  Tela cheia
                </button>
              )}
              {/* Minimizar / Expandir */}
              <button onClick={() => setMini(p => !p)} title={mini ? "Expandir" : "Minimizar"}
                style={{ background: mini ? "rgba(255,255,255,0.1)" : "#F1F5F9", border: `1px solid ${mini ? "transparent" : "#E2E8F0"}`, borderRadius: 6, color: mini ? "#CBD5E1" : "#475569", cursor: "pointer", padding: "4px 7px", display: "flex", alignItems: "center" }}>
                {mini
                  ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 9L2 12L5 12M12 5L12 2L9 2M9 12L12 12L12 9M2 5L2 2L5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 2H2V5M9 2H12V5M5 12H2V9M9 12H12V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              {/* Fechar */}
              <button onClick={close} title="Fechar"
                style={{ background: mini ? "rgba(255,255,255,0.1)" : "none", border: "none", borderRadius: 6, cursor: "pointer", color: mini ? "#CBD5E1" : "#64748B", display: "flex", padding: "4px 5px" }}>
                <X size={mini ? 13 : 16} />
              </button>
            </div>
          </div>

          {/* player — único, nunca desmonta */}
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            {video.source === "upload" ? (
              <video
                ref={iframeRef as React.RefObject<HTMLVideoElement>}
                key={video.id}
                src={`/api/videos/${video.id}/stream`}
                controls
                autoPlay
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
              />
            ) : (
              <iframe
                ref={iframeRef as React.RefObject<HTMLIFrameElement>}
                key={video.videoId}
                src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
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
