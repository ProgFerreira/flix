"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Check, ChevronDown, Lock, Play } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import type { ClassroomCourse, ClassroomLesson } from "@/app/components/course/CourseClassroom"
import {
  courseLandingLessonState,
  filterCourseCurriculum,
  isFreePreviewLesson,
  lessonKindLabel,
  moduleCurriculumMeta,
} from "@/lib/course"

export function CourseCurriculum({
  course,
  aulaHref,
}: {
  course: ClassroomCourse
  aulaHref: (lessonId: number) => string
}) {
  const [query, setQuery] = useState("")
  const [openModules, setOpenModules] = useState<Record<number, boolean>>(() => {
    const first = course.modules[0]?.id
    return first == null ? {} : { [first]: true }
  })

  const filtered = useMemo(
    () => filterCourseCurriculum(course.modules, query),
    [course.modules, query],
  )

  useEffect(() => {
    if (!query.trim()) return
    setOpenModules(Object.fromEntries(filtered.map((module) => [module.id, true])))
  }, [filtered, query])

  const expandAll = () => {
    setOpenModules(Object.fromEntries(filtered.map((module) => [module.id, true])))
  }
  const collapseAll = () => {
    setOpenModules({})
  }

  return (
    <section className="course-landing-section">
      <div className="between course-landing-curriculum-head">
        <h2 className="course-landing-kicker">Conteúdo do curso</h2>
        {course.modules.length > 0 && (
          <div className="course-landing-curriculum-tools">
            <label className="field course-landing-search" htmlFor="course-lesson-search">
              <span className="sr-only">Buscar aula</span>
              <input
                id="course-lesson-search"
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar aula"
              />
            </label>
            <button type="button" className="btn btn-ghost btn-compact" onClick={expandAll}>Expandir tudo</button>
            <button type="button" className="btn btn-ghost btn-compact" onClick={collapseAll}>Recolher tudo</button>
          </div>
        )}
      </div>
      {course.modules.length === 0 ? (
        <p className="muted-2">Nenhum módulo ainda</p>
      ) : filtered.length === 0 ? (
        <p className="muted-2">Nenhuma aula encontrada</p>
      ) : (
        <div className="course-landing-index">
          {filtered.map((module, moduleIndex) => {
            const open = Boolean(openModules[module.id])
            return (
              <div key={module.id} className="course-landing-module">
                <button
                  type="button"
                  className="course-landing-module-btn"
                  aria-expanded={open}
                  onClick={() => setOpenModules((current) => ({ ...current, [module.id]: !current[module.id] }))}
                >
                  <span className="course-landing-module-copy">
                    <span>{moduleIndex + 1}. {module.title}</span>
                    <span className="muted-2">{moduleCurriculumMeta(module.lessons)}</span>
                  </span>
                  <ChevronDown size={16} className={open ? "is-open" : undefined} aria-hidden />
                </button>
                {open && (
                  <ul className="course-landing-lessons">
                    {module.lessons.map((lesson) => (
                      <CurriculumLesson
                        key={lesson.id}
                        lesson={lesson}
                        coursePlan={course.requiredPlan}
                        href={aulaHref(lesson.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function CurriculumLesson({
  lesson,
  coursePlan,
  href,
}: {
  lesson: ClassroomLesson
  coursePlan: string
  href: string
}) {
  const state = courseLandingLessonState(lesson)
  const canPlay = state === "playable" || state === "done"
  const kind = lessonKindLabel(lesson.source)
  const freePreview = isFreePreviewLesson(lesson, coursePlan)
  const body = (
    <>
      <span className="course-landing-lesson-thumb">
        <VideoThumb src={lesson.thumbnail} alt={lesson.title} sizes="96px" />
      </span>
      <span className="course-landing-lesson-copy">
        <span className="course-landing-lesson-title">{lesson.title}</span>
        <span className="muted-2">
          {kind}
          {lesson.duration ? ` · ${lesson.duration}` : ""}
          {freePreview ? " · Aula grátis" : ""}
        </span>
      </span>
      <span className="course-landing-lesson-icon" aria-hidden>
        {state === "locked" ? (
          <Lock size={14} />
        ) : state === "done" ? (
          <Check size={14} />
        ) : lesson.source === "article" ? (
          <BookOpen size={14} />
        ) : (
          <Play size={14} />
        )}
      </span>
    </>
  )
  return (
    <li>
      {canPlay ? (
        <Link href={href} className={`course-landing-lesson${state === "done" ? " is-done" : ""}`}>
          {body}
        </Link>
      ) : (
        <span className="course-landing-lesson is-locked">{body}</span>
      )}
    </li>
  )
}
