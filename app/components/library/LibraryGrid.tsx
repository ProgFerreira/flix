"use client"

import { Play } from "lucide-react"
import type { HTMLAttributes } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Pager } from "@/app/components/Pager"
import type { Video } from "@/app/components/library/types"
import { VideoCard } from "@/app/components/library/LibraryBits"

type Props = {
  loading: boolean
  error?: boolean
  filtered: Video[]
  gridFading: boolean
  order: string
  activeCollection: number | null
  activeFilter: string
  onDragEnd: (result: DropResult) => void
  onWatch: (video: Video) => void
  onDelete: (video: Video) => void
  onEdit?: (video: Video) => void
  canEdit?: (video: Video) => boolean
  onToggleWatched: (video: Video) => void
  onToggleFavorite: (video: Video) => void
  onShare?: (video: Video) => void
  onAddToCollection?: (video: Video) => void
  page: number
  pageCount: number
  total: number
  onPage: (p: number) => void
}

export function LibraryGrid(p: Props) {
  if (p.loading) {
    return (
      <div className="catalog-grid">
        {[...Array(8)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    )
  }

  if (p.error) {
    return (
      <div className="empty">
        <Play size={40} className="empty-icon" />
        <p>Não foi possível carregar os vídeos</p>
        <p className="page-sub">Tente de novo com o botão de atualizar</p>
      </div>
    )
  }

  if (p.filtered.length === 0) {
    return (
      <div className="empty">
        <Play size={40} className="empty-icon" />
        <p>{p.activeCollection !== null ? "Nenhum vídeo nesta coleção" : "Nenhum vídeo encontrado"}</p>
        <p className="page-sub">
          {p.activeCollection !== null ? "Adicione vídeos usando o botão da pasta nos cards" : "Adicione um vídeo para começar"}
        </p>
      </div>
    )
  }

  const share = p.onShare
  const addToCol = p.onAddToCollection
  const edit = p.onEdit

  const card = (video: Video, i: number, dragHandle?: HTMLAttributes<HTMLElement> | null) => (
    <VideoCard
      key={video.id}
      video={video}
      index={i}
      dragHandle={dragHandle}
      onWatch={() => p.onWatch(video)}
      onDelete={() => p.onDelete(video)}
      onEdit={edit && (!p.canEdit || p.canEdit(video)) ? () => edit(video) : undefined}
      onToggleWatched={() => p.onToggleWatched(video)}
      onToggleFavorite={() => p.onToggleFavorite(video)}
      onShare={share ? () => share(video) : undefined}
      onAddToCollection={addToCol ? () => addToCol(video) : undefined}
      inCollection={p.activeCollection !== null}
      sharedBy={video.sharedBy}
    />
  )

  return (
    <>
      {p.order === "manual" && p.activeCollection === null ? (
        <DragDropContext onDragEnd={p.onDragEnd}>
          <Droppable droppableId="videos" direction="horizontal">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className={`catalog-grid${p.gridFading ? " fading" : ""}`}>
                {p.filtered.map((video, i) => (
                  <Draggable key={video.id} draggableId={String(video.id)} index={i}>
                    {(dp) => (
                      <div ref={dp.innerRef} {...dp.draggableProps} style={dp.draggableProps.style as React.CSSProperties}>
                        {card(video, i, dp.dragHandleProps)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className={`catalog-grid${p.gridFading ? " fading" : ""}`}>
          {p.filtered.map((video, i) => card(video, i))}
        </div>
      )}
      {p.activeCollection === null && p.activeFilter !== "shared" && (
        <Pager page={p.page} pageCount={p.pageCount} total={p.total} onPage={p.onPage} />
      )}
    </>
  )
}
