"use client"

import Link from "next/link"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import { Pager } from "@/app/components/Pager"
import { PlanBadge } from "@/app/admin/AdminBits"
import type { AdminCourse } from "@/app/components/admin/courses/types"

type Props = {
  courses: AdminCourse[]
  page: number
  pageCount: number
  total: number
  onPage: (p: number) => void
  onAskDelete: (id: number) => void
}

export function CourseGrid({ courses, page, pageCount, total, onPage, onAskDelete }: Props) {
  return (
    <>
      <div className="catalog-grid">
        {courses.map((course) => (
          <article key={course.id} className="video-card">
            <Link href={`/admin/cursos/${course.id}`} className="video-card-thumb" aria-label={`Editar ${course.title}`}>
              <VideoThumb src={course.thumbnail ?? ""} alt={course.title} sizes="(max-width: 640px) 50vw, 260px" />
              <span className={`thumb-flag ${course.published ? "is-ok" : "is-muted"}`}>{course.published ? "Publicado" : "Rascunho"}</span>
            </Link>
            <div className="video-card-body">
              <h3 className="video-card-title">{course.title}</h3>
              <p className="muted-2">{course.lessonCount} {course.lessonCount === 1 ? "aula" : "aulas"} em {course.moduleCount} {course.moduleCount === 1 ? "módulo" : "módulos"}</p>
              <div className="video-card-meta">
                <PlanBadge plan={course.requiredPlan} />
              </div>
              <div className="admin-video-actions">
                <Link href={`/catalogo/cursos/${course.slug}?preview=1`} className="btn btn-ghost">
                  <Eye size={13} /> Ver
                </Link>
                <Link href={`/admin/cursos/${course.id}`} className="btn btn-ghost"><Pencil size={13} /> Editar</Link>
                <button type="button" className="icon-btn is-danger" aria-label={`Excluir ${course.title}`} onClick={() => onAskDelete(course.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Pager page={page} pageCount={pageCount} total={total} onPage={onPage} />
    </>
  )
}
