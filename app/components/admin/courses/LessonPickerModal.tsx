"use client"

import { Search } from "lucide-react"
import { Modal } from "@/app/components/Modal"
import { VideoThumb } from "@/app/components/VideoThumb"
import type { PickerVideo } from "@/app/components/admin/courses/types"

type Props = {
  moduleTitle: string
  query: string
  onQueryChange: (q: string) => void
  videos: PickerVideo[]
  loading: boolean
  onPick: (video: PickerVideo) => void
  onClose: () => void
}

export function LessonPickerModal({ moduleTitle, query, onQueryChange, videos, loading, onPick, onClose }: Props) {
  return (
    <Modal open title={`Adicionar aula — ${moduleTitle}`} description="Escolha um vídeo já enviado em Vídeos autorais." onClose={onClose}>
      <div className="search-wrap search-wrap--wide mb-section">
        <Search size={14} className="search-ico" />
        <input
          className="input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Título da aula"
          aria-label="Buscar aula do catálogo"
          autoFocus
        />
      </div>
      {loading ? (
        <p className="muted-2">Carregando aulas...</p>
      ) : videos.length === 0 ? (
        <p className="muted-2">Nenhuma aula disponível. Envie em Vídeos autorais.</p>
      ) : (
        <div className="catalog-grid">
          {videos.map((video) => (
            <button key={video.id} type="button" className="picker-tile" onClick={() => onPick(video)}>
              <div className="picker-tile-thumb">
                <VideoThumb src={video.thumbnail} alt={video.title} sizes="200px" />
                {video.duration && <span className="thumb-time">{video.duration}</span>}
              </div>
              <div className="picker-tile-body">
                <p className="picker-tile-title">{video.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
