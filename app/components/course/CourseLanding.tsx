"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { BookOpen, Check, ChevronDown, ChevronLeft, Crown, Lock, Play } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import { loginHref } from "@/lib/auth-redirect"
import type { ClassroomCourse, ClassroomLesson } from "@/app/components/course/CourseClassroom"
import {
  COURSE_PLAN_LABEL,
  courseLandingChips,
  courseLandingCta,
  courseLandingLessonState,
  courseLandingPreviewHints,
  hasCustomThumb,
  lessonKindLabel,
  moduleCurriculumMeta,
  sumLessonDurations,
} from "@/lib/course"

function playable(lesson: ClassroomLesson) {
  return courseLandingLessonState(lesson) !== "locked"
}

function LandingCta({
  kind,
  label,
  href,
  planHref,
}: {
  kind: "upgrade" | "start" | "empty"
  label: string
  href: string | null
  planHref: string
}) {
  if (kind === "upgrade") {
    return (
      <Link href={planHref} className="btn btn-upgrade">
        <Crown size={14} aria-hidden /> {label}
      </Link>
    )
  }
  if (kind === "start" && href) {
    return <Link href={href} className="btn btn-primary">{label}</Link>
  }
  return <p className="muted-2">{label}</p>
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

  const ctaHref = start ? aulaHref(start.id) : null
  const cta = courseLandingCta({
    locked: course.locked,
    isLoggedIn,
    requiredPlan: course.requiredPlan,
    hasProgress,
    hasPlayableLesson: Boolean(ctaHref),
  })
  const chips = courseLandingChips({
    lessonCount: course.lessonCount || lessons.length,
    moduleCount: course.modules.length,
    totalSeconds: sumLessonDurations(lessons),
  })
  const previewHints = isPreview
    ? courseLandingPreviewHints({
        thumbnail: course.thumbnail,
        description: course.description,
        learnings: course.learnings,
      })
    : []
  const hintByField = Object.fromEntries(previewHints.map((hint) => [hint.field, hint.message]))
  const planLabel = COURSE_PLAN_LABEL[course.requiredPlan] ?? course.requiredPlan
  const hasCover = hasCustomThumb(course.thumbnail)
  const progressPct = course.progressPercent ?? 0
  const showSticky = cta.kind === "upgrade" || cta.kind === "start"

  return (
    <div className={`course-landing${isPreview ? " has-preview" : ""}${showSticky ? " has-sticky-cta" : ""}`}>
      {isPreview && (
        <div className="classroom-preview-bar">
          <p>Você está no modo de pré-visualização.</p>
          <Link href={backHref} className="btn btn-ghost btn-compact">Fechar pré-visualização</Link>
        </div>
      )}

      <div className="course-landing-wrap">
        <Link href={backHref} className="btn btn-ghost btn-compact">
          <ChevronLeft size={14} aria-hidden /> {isPreview ? "Voltar ao editor" : "Voltar ao catálogo"}
        </Link>

        <section className="course-landing-hero">
          <div className={`course-landing-hero-media${hasCover ? "" : " is-placeholder"}`}>
            <VideoThumb src={course.thumbnail} alt={course.title} sizes="(max-width: 900px) 100vw, 420px" />
            {cta.kind === "start" && ctaHref ? (
              <Link href={ctaHref} className="play-btn" tabIndex={-1} aria-hidden="true">
                <Play size={18} color="#fff" aria-hidden />
              </Link>
            ) : null}
            {!hasCover && hintByField.thumbnail ? (
              <p className="course-landing-media-hint">{hintByField.thumbnail}</p>
            ) : null}
          </div>
          <div className="course-landing-hero-copy">
            <span className={`badge badge-${course.requiredPlan}`}>
              {course.locked ? `Exige ${planLabel}+` : planLabel}
            </span>
            <h1 className="course-landing-title">{course.title}</h1>
            {course.description ? (
              <p className="course-landing-lead">{course.description}</p>
            ) : null}
            {chips.length > 0 && (
              <ul className="course-landing-chips">
                {chips.map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
            )}
            {hasProgress && progressPct > 0 && (
              <div className="course-landing-progress-wrap">
                <div className="course-landing-progress" aria-hidden="true">
                  <span style={{ width: `${progressPct}%` }} />
                </div>
                <p className="muted-2">
                  {progressPct}% concluído
                  {course.continueLesson ? ` · Continuar: ${course.continueLesson.title}` : ""}
                </p>
              </div>
            )}
            <div className="course-landing-actions">
              <LandingCta kind={cta.kind} label={cta.label} href={ctaHref} planHref={planHref} />
            </div>
          </div>
        </section>

        {course.description ? (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">Sobre o curso</h2>
            <p className="course-landing-copy">{course.description}</p>
          </section>
        ) : hintByField.description ? (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">Sobre o curso</h2>
            <p className="course-landing-hint">{hintByField.description}</p>
          </section>
        ) : null}

        {course.learnings && course.learnings.length > 0 ? (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">O que você vai aprender</h2>
            <ul className="course-landing-learnings">
              {course.learnings.map((item) => (
                <li key={item}>
                  <Check size={16} aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : hintByField.learnings ? (
          <section className="course-landing-section">
            <h2 className="course-landing-kicker">O que você vai aprender</h2>
            <p className="course-landing-hint">{hintByField.learnings}</p>
          </section>
        ) : null}

        <section className="course-landing-section">
          <h2 className="course-landing-kicker">Conteúdo do curso</h2>
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
                      <span className="course-landing-module-copy">
                        <span>{moduleIndex + 1}. {module.title}</span>
                        <span className="muted-2">{moduleCurriculumMeta(module.lessons)}</span>
                      </span>
                      <ChevronDown size={16} className={open ? "is-open" : undefined} aria-hidden />
                    </button>
                    {open && (
                      <ul className="course-landing-lessons">
                        {module.lessons.map((lesson) => {
                          const state = courseLandingLessonState(lesson)
                          const canPlay = state === "playable" || state === "done"
                          const kind = lessonKindLabel(lesson.source)
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
                            <li key={lesson.id}>
                              {canPlay ? (
                                <Link href={aulaHref(lesson.id)} className={`course-landing-lesson${state === "done" ? " is-done" : ""}`}>
                                  {body}
                                </Link>
                              ) : (
                                <span className="course-landing-lesson is-locked">
                                  {body}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {showSticky && (
        <div className="course-landing-cta-bar">
          <LandingCta kind={cta.kind} label={cta.label} href={ctaHref} planHref={planHref} />
        </div>
      )}
    </div>
  )
}
