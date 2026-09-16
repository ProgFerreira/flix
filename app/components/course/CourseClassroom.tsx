"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Crown, Lock, Menu, X } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import { LessonArticle } from "@/app/components/course/LessonArticle"
import { LessonVideo } from "@/app/components/course/LessonVideo"
import { loginHref } from "@/lib/auth-redirect"
import { isLessonComplete, mergeLessonSeconds } from "@/lib/course"

export type ClassroomLesson = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  channelName: string | null
  source: "youtube" | "upload"
  videoId: string | null
  requiredPlan: string
  published: boolean
  status: string
  qualities: string[]
  progressSeconds: number
  notes?: string | null
  locked: boolean
}

export type ClassroomCourse = {
  id: number
  slug: string
  title: string
  description: string | null
  thumbnail: string
  requiredPlan: string
  lessonCount: number
  completedCount: number
  progressPercent: number | null
  locked: boolean
  continueLesson: { id: number; title: string } | null
  learnings?: string[]
  modules: { id: number; title: string; lessons: ClassroomLesson[] }[]
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const PLAN_COLOR: Record<string, string> = { free: "#64748B", premium: "#7C3AED", pro: "#B45309" }

function lessonBlocked(lesson: ClassroomLesson) {
  return lesson.locked || lesson.status === "processing" || lesson.status === "error"
}

function lessonPlayable(lesson: ClassroomLesson) {
  return !lessonBlocked(lesson)
}

export function CourseClassroom({
  course,
  lessonId = null,
  preview = false,
}: {
  course: ClassroomCourse
  lessonId?: number | null
  preview?: boolean
}) {
  const router = useRouter()
  const { status } = useSession()
  const isLoggedIn = status === "authenticated"
  const isPreview = preview
  const aulaParam = lessonId ?? 0

  const lessons = useMemo(
    () => course.modules.flatMap((module) => module.lessons),
    [course.modules],
  )

  const initialId = useMemo(() => {
    if (lessons.some((lesson) => lesson.id === aulaParam)) return aulaParam
    if (course.continueLesson && lessons.some((lesson) => lesson.id === course.continueLesson?.id)) {
      return course.continueLesson.id
    }
    return lessons[0]?.id ?? null
  }, [aulaParam, course.continueLesson, lessons])

  const [currentId, setCurrentId] = useState<number | null>(initialId)
  const [navOpen, setNavOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [openModules, setOpenModules] = useState<Record<number, boolean>>(() => {
    const currentModule = course.modules.find((module) => module.lessons.some((lesson) => lesson.id === initialId))
    const fallback = course.modules[0]
    const target = currentModule ?? fallback
    return target ? { [target.id]: true } : {}
  })
  const [secondsById, setSecondsById] = useState<Record<number, number>>(() => (
    Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson.progressSeconds]))
  ))

  useEffect(() => {
    setCurrentId(initialId)
  }, [initialId])

  useEffect(() => {
    const module = course.modules.find((row) => row.lessons.some((lesson) => lesson.id === currentId))
    if (!module) return
    setOpenModules((prev) => (prev[module.id] ? prev : { ...prev, [module.id]: true }))
  }, [course.modules, currentId])

  const current = lessons.find((lesson) => lesson.id === currentId) ?? lessons[0] ?? null
  const playable = lessons.filter(lessonPlayable)
  const playableIndex = current ? playable.findIndex((lesson) => lesson.id === current.id) : -1
  const prevLesson = playableIndex > 0 ? playable[playableIndex - 1] : null
  const nextLesson = playableIndex >= 0 && playableIndex < playable.length - 1 ? playable[playableIndex + 1] : null
  const currentLessonId = current?.id ?? null

  const onLessonProgress = useCallback((seconds: number) => {
    if (currentLessonId == null) return
    setSecondsById((prev) => mergeLessonSeconds(prev, currentLessonId, seconds))
  }, [currentLessonId])

  const goLesson = (lesson: ClassroomLesson, play: boolean) => {
    setNavOpen(false)
    setAutoPlay(play && lessonPlayable(lesson))
    setCurrentId(lesson.id)
    const params = new URLSearchParams()
    params.set("aula", String(lesson.id))
    if (isPreview) params.set("preview", "1")
    router.replace(`/catalogo/cursos/${course.slug}?${params}`, { scroll: false })
  }

  const landingHref = `/catalogo/cursos/${course.slug}${isPreview ? "?preview=1" : ""}`
  const editorHref = `/admin/cursos/${course.id}`
  const progressPct = course.progressPercent ?? 0
  const planHref = isLoggedIn ? "/plano" : loginHref(`/catalogo/cursos/${course.slug}`)

  return (
    <div className={`classroom${isPreview ? " has-preview" : ""}`}>
      {isPreview && (
        <div className="classroom-preview-bar">
          <p>Você está no modo de pré-visualização.</p>
          <Link href={editorHref} className="btn btn-ghost btn-compact">Fechar pré-visualização</Link>
        </div>
      )}

      {navOpen && (
        <button type="button" className="classroom-dimmer" aria-label="Fechar currículo" onClick={() => setNavOpen(false)} />
      )}

      <div className="classroom-shell">
        <aside className={`classroom-nav${navOpen ? " is-open" : ""}`}>
          <div className="classroom-index-head">
            <Link href={landingHref} className="classroom-back is-plain" aria-label="Voltar ao curso">
              <ChevronLeft size={18} />
            </Link>
            <p className="classroom-index-title">Índice</p>
          </div>
          <div className="classroom-progress" aria-label={`${progressPct}% concluído`}>
            <span style={{ ["--bar-pct" as string]: `${progressPct}%` }} />
          </div>

          <nav className="classroom-curriculum" aria-label="Currículo do curso">
            {course.modules.length === 0 && (
              <p className="muted-2 classroom-empty-nav">Este curso ainda não tem aulas</p>
            )}
            {course.modules.map((module, moduleIndex) => {
              const open = Boolean(openModules[module.id])
              return (
                <section key={module.id} className="classroom-module">
                  <button
                    type="button"
                    className="classroom-module-toggle"
                    aria-expanded={open}
                    onClick={() => setOpenModules((current) => ({ ...current, [module.id]: !current[module.id] }))}
                  >
                    <span>{moduleIndex + 1}. {module.title}</span>
                    <ChevronDown size={14} className={open ? "is-open" : undefined} aria-hidden />
                  </button>
                  {open && (
                    <ul className="classroom-lessons">
                      {module.lessons.map((lesson) => {
                        const currentLesson = current?.id === lesson.id
                        const done = isLessonComplete(secondsById[lesson.id] ?? lesson.progressSeconds, lesson.duration)
                        const blocked = lessonBlocked(lesson)
                        const label = lesson.locked
                          ? `${lesson.title} (bloqueado)`
                          : `Assistir ${lesson.title}`
                        return (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              className={`classroom-lesson${currentLesson ? " is-current" : ""}${done ? " is-done" : ""}${lesson.locked ? " is-locked" : ""}`}
                              aria-current={currentLesson ? "page" : undefined}
                              aria-label={label}
                              onClick={() => goLesson(lesson, true)}
                            >
                              <span className="classroom-dot" aria-hidden="true">
                                {lesson.locked ? <Lock size={10} /> : done ? <Check size={10} /> : null}
                              </span>
                              <span className="classroom-lesson-label">
                                {lesson.title}
                                {blocked && lesson.status === "processing" ? " (processando)" : ""}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </nav>
        </aside>

        <main id="conteudo" className="classroom-main">
          <div className="classroom-mobile-bar">
            <button type="button" className="icon-btn" aria-label="Abrir currículo" onClick={() => setNavOpen(true)}>
              <Menu size={18} />
            </button>
            <p className="classroom-mobile-title">{course.title}</p>
            <Link href={landingHref} className="icon-btn" aria-label="Voltar ao curso">
              <X size={16} />
            </Link>
          </div>

          {!current ? (
            <div className="empty">
              <p>Este curso ainda não tem aulas</p>
              <Link href={landingHref} className="btn btn-ghost">Voltar</Link>
            </div>
          ) : (
            <article className="classroom-article">
              <h1 className="classroom-lesson-title">{current.title}</h1>

              {current.locked ? (
                <div className="classroom-hero classroom-hero-locked">
                  <VideoThumb src={current.thumbnail} alt={current.title} sizes="(max-width: 900px) 100vw, 860px" />
                  <div className="classroom-lock-msg">
                    <Lock size={22} />
                    <span className="lock-plan" style={{ ["--plan-color" as string]: PLAN_COLOR[current.requiredPlan] }}>
                      Exige {PLAN_LABEL[current.requiredPlan]}+
                    </span>
                    <Link href={planHref} className="btn btn-upgrade">
                      <Crown size={12} /> {isLoggedIn ? `Assinar ${PLAN_LABEL[current.requiredPlan]}` : "Entrar pra assistir"}
                    </Link>
                  </div>
                </div>
              ) : current.status === "processing" || current.status === "error" ? (
                <div className="classroom-hero classroom-hero-locked">
                  <VideoThumb src={current.thumbnail} alt={current.title} sizes="(max-width: 900px) 100vw, 860px" />
                  <p className="classroom-lock-msg">{current.status === "error" ? "Esta aula não pôde ser processada." : "Esta aula ainda está sendo processada."}</p>
                </div>
              ) : (
                <LessonVideo
                  id={current.id}
                  title={current.title}
                  source={current.source}
                  videoId={current.videoId}
                  startSeconds={secondsById[current.id] ?? current.progressSeconds}
                  qualities={current.qualities}
                  autoPlay={autoPlay}
                  onProgress={onLessonProgress}
                />
              )}

              {course.locked && current.locked && (
                <div className="banner">
                  <Crown size={16} color="#1E40AF" />
                  <p>
                    Este curso exige {PLAN_LABEL[course.requiredPlan]}.
                    {" "}
                    <Link href={planHref} className="link">
                      {isLoggedIn ? `Assinar ${PLAN_LABEL[course.requiredPlan]}` : "Entrar pra assinar"}
                    </Link>
                  </p>
                </div>
              )}

              <LessonArticle notes={current.notes ?? null} />

              <div className="classroom-pager">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!prevLesson}
                  aria-label="Aula anterior"
                  onClick={() => prevLesson && goLesson(prevLesson, true)}
                >
                  <ChevronLeft size={16} /> Aula anterior
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!nextLesson}
                  onClick={() => nextLesson && goLesson(nextLesson, true)}
                >
                  Próxima aula <ChevronRight size={16} />
                </button>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  )
}
