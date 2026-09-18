"use client"

import type { HTMLAttributes, ReactNode } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import type { Video } from "@/app/components/library/types"

export function LibraryGridSortable({
  videos,
  gridFading,
  onDragEnd,
  renderCard,
}: {
  videos: Video[]
  gridFading: boolean
  onDragEnd: (result: DropResult) => void
  renderCard: (video: Video, index: number, dragHandle?: HTMLAttributes<HTMLElement> | null) => ReactNode
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="videos" direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`catalog-grid${gridFading ? " fading" : ""}`}>
            {videos.map((video, i) => (
              <Draggable key={video.id} draggableId={String(video.id)} index={i}>
                {(dp) => (
                  <div ref={dp.innerRef} {...dp.draggableProps} style={dp.draggableProps.style as React.CSSProperties}>
                    {renderCard(video, i, dp.dragHandleProps)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
