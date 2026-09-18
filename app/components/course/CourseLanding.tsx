"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Check, ChevronLeft } from "lucide-react"
import { loginHref } from "@/lib/auth-redirect"
import type { ClassroomCourse, ClassroomLesson } from "@/app/components/course/CourseClassroom"
import { CourseLandingSidebar } from "@/app/components/course/CourseLandingSidebar"
import { CourseCurriculum } from "@/app/components/course/CourseCurriculum"
import { CourseReviews } from "@/app/components/course/CourseReviews"
import { CourseRail } from "@/app/catalogo/CourseRail"
import {
  COURSE_LEVEL_LABEL,
  COURSE_PLAN_LABEL,
  courseLandingCta,
  courseLandingPreviewHints,
} from "@/lib/course"

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
  const signInHref = loginHref(`/catalogo/cursos/${course.slug}`)

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
  const previewHints = isPreview
    ? courseLandingPreviewHints({
        thumbnail: course.thumbnail,
        description: course.description,
        learnings: course.learnings,
        instructorName: course.instructorName ?? null,
        level: course.level ?? null,
        requirements: course.requirements ?? [],
        audience: course.audience ?? [],
        faq: course.faq ?? [],
      })
    : []
  const hintByField = Object.fromEntries(previewHints.map((hint) => [hint.field, hint.message]))
  const planLabel = COURSE_PLAN_LABEL[course.requiredPlan] ?? course.requiredPlan
  const progressPct = course.progressPercent ?? 0
  const showSticky = cta.kind === "upgrade" || cta.kind === "start"
  const reviews = course.reviews ?? { average: null, count: 0, mine: null, items: [] }
  const canWriteReview = isLoggedIn && !course.locked && !isPreview

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

        <div className="course-landing-grid">
          <div className="course-landing-main">
            <header className="course-landing-heading">
              <span className={`badge badge-${course.requiredPlan}`}>
                {course.locked ? `Exige ${planLabel}+` : planLabel}
              </span>
              <h1 className="course-landing-title">{course.title}</h1>
              {course.description ? <p className="course-landing-lead">{course.description}</p> : null}
              {hasProgress && progressPct > 0 && (
                <div className="course-landing-progress-wrap">
                  <div className="course-landing-progress" aria-hidden="true">
                    <span style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="muted-2">
                    {course.completedCount} de {course.lessonCount} aulas · {progressPct}% concluído
                    {course.continueLesson ? ` · Continuar: ${course.continueLesson.title}` : ""}
                  </p>
                </div>
              )}
            </header>

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

            {(course.instructorName || course.level || (course.requirements?.length ?? 0) > 0 || (course.audience?.length ?? 0) > 0 || hintByField.instructorName || hintByField.level || hintByField.requirements || hintByField.audience) && (
              <section className="course-landing-section">
                <h2 className="course-landing-kicker">Detalhes</h2>
                <dl className="course-landing-meta">
                  {course.instructorName ? (
                    <>
                      <dt>Instrutor</dt>
                      <dd>{course.instructorName}</dd>
                    </>
                  ) : hintByField.instructorName ? (
                    <>
                      <dt>Instrutor</dt>
                      <dd className="course-landing-hint">{hintByField.instructorName}</dd>
                    </>
                  ) : null}
                  {course.level ? (
                    <>
                      <dt>Nível</dt>
                      <dd>{COURSE_LEVEL_LABEL[course.level] ?? course.level}</dd>
                    </>
                  ) : hintByField.level ? (
                    <>
                      <dt>Nível</dt>
                      <dd className="course-landing-hint">{hintByField.level}</dd>
                    </>
                  ) : null}
                </dl>
                {course.requirements && course.requirements.length > 0 ? (
                  <>
                    <h3 className="course-landing-subkicker">Requisitos</h3>
                    <ul className="course-landing-bullets">
                      {course.requirements.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </>
                ) : hintByField.requirements ? (
                  <p className="course-landing-hint">{hintByField.requirements}</p>
                ) : null}
                {course.audience && course.audience.length > 0 ? (
                  <>
                    <h3 className="course-landing-subkicker">Para quem é</h3>
                    <ul className="course-landing-bullets">
                      {course.audience.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </>
                ) : hintByField.audience ? (
                  <p className="course-landing-hint">{hintByField.audience}</p>
                ) : null}
              </section>
            )}

            <CourseCurriculum course={course} aulaHref={aulaHref} />

            {course.faq && course.faq.length > 0 ? (
              <section className="course-landing-section">
                <h2 className="course-landing-kicker">Perguntas frequentes</h2>
                <div className="course-landing-faq">
                  {course.faq.map((item) => (
                    <details key={item.question} className="course-landing-faq-item">
                      <summary>{item.question}</summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : hintByField.faq ? (
              <section className="course-landing-section">
                <h2 className="course-landing-kicker">Perguntas frequentes</h2>
                <p className="course-landing-hint">{hintByField.faq}</p>
              </section>
            ) : null}

            <CourseReviews
              courseSlug={course.slug}
              initial={reviews}
              canWrite={canWriteReview}
              isLoggedIn={isLoggedIn}
              loginHref={signInHref}
            />

            {course.related && course.related.length > 0 ? (
              <CourseRail courses={course.related} label="Outros cursos" />
            ) : null}
          </div>

          <CourseLandingSidebar
            course={course}
            preview={isPreview}
            cta={cta}
            ctaHref={ctaHref}
            planHref={planHref}
            isLoggedIn={isLoggedIn}
            loginHref={signInHref}
          />
        </div>
      </div>

      {showSticky && (
        <div className="course-landing-cta-bar">
          {cta.kind === "upgrade" ? (
            <Link href={planHref} className="btn btn-upgrade">{cta.label}</Link>
          ) : cta.kind === "start" && ctaHref ? (
            <Link href={ctaHref} className="btn btn-primary">{cta.label}</Link>
          ) : null}
        </div>
      )}
    </div>
  )
}
