"use client"

import { Draggable, Droppable } from "@hello-pangea/dnd"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import type { ModuleDraft } from "@/app/components/admin/courses/types"

type Props = {
  module: ModuleDraft
  index: number
  onTitleChange: (title: string) => void
  onRemoveModule: () => void
  onRemoveLesson: (videoId: number) => void
  onOpenPicker: () => void
}

export function ModuleCard({ module, index, onTitleChange, onRemoveModule, onRemoveLesson, onOpenPicker }: Props) {
  return (
    <Draggable draggableId={module.key} index={index}>
      {(dragProvided) => (
        <section ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={dragProvided.draggableProps.style as React.CSSProperties} className="card module-card">
          <div className="module-card-head">
            <span {...dragProvided.dragHandleProps} className="icon-btn module-drag-handle" aria-label={`Reordenar módulo ${index + 1}`}>
              <GripVertical size={16} />
            </span>
            <input
              className="input"
              value={module.title}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-label={`Título do módulo ${index + 1}`}
              placeholder={`Módulo ${index + 1}`}
            />
            <span className="module-badge">{module.lessons.length} {module.lessons.length === 1 ? "aula" : "aulas"}</span>
            <button type="button" className="icon-btn is-danger" aria-label="Remover módulo" onClick={onRemoveModule}><Trash2 size={14} /></button>
          </div>
          <div className="module-card-body">
            <Droppable droppableId={module.key} type="LESSON">
              {(dropProvided, snapshot) => (
                <ul ref={dropProvided.innerRef} {...dropProvided.droppableProps} className={`course-lessons${snapshot.isDraggingOver ? " is-drop-target" : ""}`}>
                  {module.lessons.map((lesson, lessonIndex) => (
                    <Draggable key={lesson.videoId} draggableId={`lesson-${lesson.videoId}`} index={lessonIndex}>
                      {(lp) => (
                        <li ref={lp.innerRef} {...lp.draggableProps} style={lp.draggableProps.style as React.CSSProperties} className="course-lesson">
                          <div className="video-card-thumb course-lesson-thumb">
                            <VideoThumb src={lesson.thumbnail} alt={lesson.title} sizes="160px" />
                            <span {...lp.dragHandleProps} className="thumb-drag" aria-label={`Reordenar ${lesson.title}`}>
                              <GripVertical size={12} color="#fff" />
                            </span>
                          </div>
                          <span className="course-lesson-body">
                            <strong>{lesson.title}</strong>
                            {lesson.duration && <span className="muted-2">{lesson.duration}</span>}
                          </span>
                          <button type="button" className="btn btn-ghost btn-compact" onClick={() => onRemoveLesson(lesson.videoId)}>
                            Remover
                          </button>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {dropProvided.placeholder}
                  {module.lessons.length === 0 && <li className="muted-2">Nenhuma aula ainda — adicione abaixo.</li>}
                </ul>
              )}
            </Droppable>
            <button type="button" className="btn btn-ghost" onClick={onOpenPicker}>
              <Plus size={14} /> Adicionar aula
            </button>
          </div>
        </section>
      )}
    </Draggable>
  )
}
