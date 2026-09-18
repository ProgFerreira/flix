"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import dynamic from "next/dynamic"

export type PlaylistItem = {
  id: number
  videoId?: string | null
  title: string
  channelName?: string | null
  source?: "youtube" | "upload" | "article"
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

const PlayerOverlay = dynamic(
  () => import("@/app/contexts/PlayerOverlay").then((mod) => mod.PlayerOverlay),
  { ssr: false },
)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<WatchVideo | null>(null)
  const [playKey, setPlayKey] = useState(0)

  const play = useCallback((v: WatchVideo) => {
    setVideo(v)
    setPlayKey((key) => key + 1)
  }, [])
  const close = useCallback(() => {
    setVideo(null)
  }, [])

  return (
    <PlayerContext.Provider value={{ play, close, current: video }}>
      {children}
      {video ? (
        <PlayerOverlay key={playKey} video={video} onPlay={play} onClose={close} />
      ) : null}
    </PlayerContext.Provider>
  )
}
