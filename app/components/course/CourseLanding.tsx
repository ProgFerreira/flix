"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ChevronDown, ChevronLeft, Crown, Lock } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import { loginHref } from "@/lib/auth-redirect"
import type { ClassroomCourse, ClassroomLesson } from "@/app/components/course/CourseClassroom"

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

function playable(lesson: ClassroomLesson) {
  return !lesson.locked && lesson.status !== "processing" && lesson.status !== "error"
}

export function CourseLanding({
  course,
  preview = false,
}: {
  course: ClassroomCourse
  preview?: boolean
}) {
  const { status } = useSession()
  const isLoggedIn = status === "authenticated"
  const isPreview = preview
  const catalogHref = "/catalogo"
  const backHref = isPreview ? `/admin/cursos/${course.id}` : catalogHref
  const planHref = isLoggedIn ? "/plano" : loginHref(`/catalogo/cursos/${course.slug}`)

  const lessons = useMemo(
    () => course.modules.flatMap((module) => module.lessons),
    [course.modules],
  )
  const hasProgress = course.completedCount > 0 || (course.progressPercent ?? 0) > 0
  const start = useMemo(() => {
    if (hasProgress && course.continueLesson) {
      const found = lessons.find((lesson) => lesson.id === course.continueLesson?.id && playable(lesson))
      if (found) return found
    }
    return lessons.find(playable) ?? null
  }, [course.continueLesson, hasProgress, lessons])

  const [openModules, setOpenModules] = useState<Record<number, boolean>>(() => {
    const first = course.modules[0]?.id
    return first == null ? {} : { [first]: true }
  })

  const aulaHref = (lessonId: number) => {
    const params = new URLSearchParams()
    params.set("aula", String(lessonId))
    if (isPreview) params.set("preview", "1")
    return `/catalogo/cursos/${course.slug}?${params}`
  }

  const ctaLabel = hasProgress ? "Continuar" : "Iniciar curso"
  const ctaHref = start ? aulaHref(start.id) : null

  return (
    <div className={`course-landing${isPreview ? " has-preview" : ""}`}>
      {isPreview && (
        <div className="classroom-preview-bar">
          <p>Você está no modo de pré-visualização.</p>
          <Link href={backHref} className="btn btn-ghost btn-compact">Fechar pré-visualização</Link>
        </div>
      )}

      <div className="course-landing-wrap">
        <Link href={backHref} className="btn btn-ghost btn-compact">
          <ChevronLeft size={14} /> {isPreview ? "Voltar ao editor" : "Voltar ao catálogo"}
        </Link>

        <section className="course-landing-hero">
          <VideoThumb src={course.thumbnail} alt={course.title} sizes="(max-width: 900px) 100vw, 860px" />
          <div className="course-landing-hero-copy">
            <h1 className="course-landing-title">{course.title}</h1>
            {course.locked ? (
              <Link href={planHref} className="btn btn-upgrade">
                <Crown size={14} /> {isLoggedIn ? `Assinar ${PLAN_LABEL[course.requiredPlan]}` : "Entrar pra assinar"}
              </Link>
            ) : ctaHref ? (
              <Link href={ctaHref} className="btn btn-primary">{ctaLabel}</Link>
            ) : (
              <p className="muted-2">Este curso ainda não tem aulas</p>
            )}
          </div>
        </section>

        {course.description && (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">Sobre o curso</h2>
            <p className="course-landing-copy">{course.description}</p>
          </section>
        )}

        {course.learnings && course.learnings.length > 0 && (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">O que você vai aprender</h2>
            <ul className="course-landing-learnings">
              {course.learnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="course-landing-section">
          <h2 className="course-landing-kicker">Índice</h2>
          {course.modules.length === 0 ? (
            <p className="muted-2">Nenhum módulo ainda</p>
          ) : (
            <div className="course-landing-index">
              {course.modules.map((module, moduleIndex) => {
                const open = Boolean(openModules[module.id])
                return (
                  <div key={module.id} className="course-landing-module">
                    <button
                      type="button"
                      className="course-landing-module-btn"
                      aria-expanded={open}
                      onClick={() => setOpenModules((current) => ({ ...current, [module.id]: !current[module.id] }))}
                    >
                      <span>{moduleIndex + 1}. {module.title}</span>
                      <ChevronDown size={16} className={open ? "is-open" : undefined} aria-hidden />
                    </button>
                    {open && (
                      <ul className="course-landing-lessons">
                        {module.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            {playable(lesson) ? (
                              <Link href={aulaHref(lesson.id)} className="course-landing-lesson">
                                {lesson.title}
                              </Link>
                            ) : (
                              <span className="course-landing-lesson is-locked">
                                <Lock size={12} aria-hidden /> {lesson.title}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
