"use client"

import { useEffect, useRef, useState } from "react"

function streamSrc(id: number, quality: string) {
  if (quality === "source") return `/api/videos/${id}/stream?quality=source`
  if (quality === "480") return `/api/videos/${id}/stream?quality=480`
  return `/api/videos/${id}/stream`
}

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

type Props = {
  id: number
  title: string
  source: "youtube" | "upload"
  videoId: string | null
  startSeconds: number
  qualities: string[]
  autoPlay: boolean
  onProgress?: (seconds: number) => void
}

export function LessonVideo({
  id, title, source, videoId, startSeconds, qualities, autoPlay, onProgress,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSaved = useRef(0)
  const resumeAt = useRef(startSeconds)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  const startSecondsRef = useRef(startSeconds)
  startSecondsRef.current = startSeconds
  const qualitiesRef = useRef(qualities)
  qualitiesRef.current = qualities
  const [quality, setQuality] = useState(qualities.includes("480") ? "480" : "auto")
  const hasQualitySwitch = qualities.includes("480") && source === "upload"

  useEffect(() => {
    lastSaved.current = 0
    resumeAt.current = startSecondsRef.current
    setQuality(qualitiesRef.current.includes("480") ? "480" : "auto")
  }, [id])

  useEffect(() => {
    if (source !== "upload") return
    const el = videoRef.current
    if (!el) return

    const onLoaded = () => {
      if (resumeAt.current > 3) el.currentTime = resumeAt.current
    }
    const persistNow = () => {
      const t = el.currentTime
      if (t < 1) return
      onProgressRef.current?.(t)
      void saveProgress(id, t)
    }
    const onTime = () => {
      const t = el.currentTime
      if (t < 1) return
      onProgressRef.current?.(t)
      if (t - lastSaved.current < 5) return
      lastSaved.current = t
      void saveProgress(id, t)
    }

    el.addEventListener("loadedmetadata", onLoaded)
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("pause", persistNow)
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded)
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("pause", persistNow)
      persistNow()
    }
  }, [id, quality, source])

  const changeQuality = (next: string) => {
    const el = videoRef.current
    if (el) resumeAt.current = el.currentTime
    setQuality(next)
  }

  return (
    <div className="classroom-hero">
      {hasQualitySwitch && (
        <div className="classroom-hero-tools">
          <div className="select-wrap is-on-dark">
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
        </div>
      )}
      <div className="classroom-hero-media">
        {source === "upload" ? (
          <video
            ref={videoRef}
            key={`${id}-${quality}`}
            src={streamSrc(id, quality)}
            controls
            autoPlay={autoPlay}
            title={title}
          />
        ) : (
          <iframe
            title={title}
            key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?${autoPlay ? "autoplay=1" : "autoplay=0"}${startSeconds > 3 ? `&start=${Math.floor(startSeconds)}` : ""}`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}
      </div>
    </div>
  )
}
