"use client"

import { useState } from "react"
import Link from "next/link"
import { Copy, Crown, Play, Share2, Star } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"
import { LessonVideo } from "@/app/components/course/LessonVideo"
import type { ClassroomCourse } from "@/app/components/course/CourseClassroom"
import {
  COURSE_LEVEL_LABEL,
  COURSE_PLAN_LABEL,
  formatCourseDuration,
  hasCustomThumb,
} from "@/lib/course"

export function CourseLandingSidebar({
  course,
  preview,
  cta,
  ctaHref,
  planHref,
  isLoggedIn,
  loginHref,
  onFavorited,
}: {
  course: ClassroomCourse
  preview: boolean
  cta: { kind: "upgrade" | "start" | "empty"; label: string }
  ctaHref: string | null
  planHref: string
  isLoggedIn: boolean
  loginHref: string
  onFavorited?: (value: boolean) => void
}) {
  const hasCover = hasCustomThumb(course.thumbnail)
  const lessons = course.modules.flatMap((module) => module.lessons)
  const trailer = lessons.find((lesson) => lesson.id === course.trailerVideoId) ?? null
  const canPlayTrailer = Boolean(trailer && trailer.source !== "article" && !trailer.locked)
  const [favorited, setFavorited] = useState(Boolean(course.favorited))
  const [savingFav, setSavingFav] = useState(false)
  const [shareText, setShareText] = useState<string | null>(null)

  const stats = [
    course.lessonCount ? `${course.lessonCount} ${course.lessonCount === 1 ? "aula" : "aulas"}` : null,
    course.modules.length ? `${course.modules.length} ${course.modules.length === 1 ? "módulo" : "módulos"}` : null,
    (course.videoCount ?? 0) > 0 ? `${course.videoCount} ${(course.videoCount ?? 0) === 1 ? "vídeo" : "vídeos"}` : null,
    (course.articleCount ?? 0) > 0 ? `${course.articleCount} ${(course.articleCount ?? 0) === 1 ? "artigo" : "artigos"}` : null,
    formatCourseDuration(course.totalSeconds ?? 0) || null,
    course.level ? COURSE_LEVEL_LABEL[course.level] ?? course.level : null,
    course.updatedAtLabel ? `Atualizado em ${course.updatedAtLabel}` : null,
  ].filter((item): item is string => Boolean(item))

  const canonicalUrl = () => {
    const path = `/catalogo/cursos/${course.slug}`
    if (typeof window === "undefined") return path
    return `${window.location.origin}${path}`
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl())
      setShareText("Link copiado")
    } catch {
      setShareText("Não foi possível copiar o link.")
    }
  }

  const share = async () => {
    const url = canonicalUrl()
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: course.title, url })
        return
      } catch {
        // fallback to copy
      }
    }
    await copyLink()
  }

  const toggleFavorite = async () => {
    if (preview) return
    if (!isLoggedIn) {
      window.location.href = loginHref
      return
    }
    setSavingFav(true)
    try {
      const res = await fetch(`/api/catalog/courses/${course.slug}/favorite`, { method: "PATCH" })
      if (!res.ok) throw new Error("fail")
      const data = await res.json() as { favorited: boolean }
      setFavorited(data.favorited)
      onFavorited?.(data.favorited)
    } catch {
      setShareText("Não foi possível atualizar o favorito.")
    } finally {
      setSavingFav(false)
    }
  }

  return (
    <aside className="course-landing-side">
      <div className="card course-landing-side-card">
        <div className={`course-landing-hero-media${hasCover || canPlayTrailer ? "" : " is-placeholder"}`}>
          {canPlayTrailer && trailer ? (
            <div className="course-landing-trailer">
              <LessonVideo
                id={trailer.id}
                title={trailer.title}
                source={trailer.source === "upload" ? "upload" : "youtube"}
                videoId={trailer.videoId}
                startSeconds={trailer.progressSeconds}
                qualities={trailer.qualities}
                autoPlay={false}
              />
            </div>
          ) : (
            <>
              <VideoThumb src={course.thumbnail} alt={course.title} sizes="(max-width: 900px) 100vw, 320px" />
              {cta.kind === "start" && ctaHref ? (
                <Link href={ctaHref} className="play-btn" tabIndex={-1} aria-hidden="true">
                  <Play size={18} color="#fff" aria-hidden />
                </Link>
              ) : null}
            </>
          )}
        </div>

        {stats.length > 0 && (
          <ul className="course-landing-stats">
            {stats.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}

        <div className="course-landing-actions">
          {cta.kind === "upgrade" ? (
            <Link href={planHref} className="btn btn-upgrade">
              <Crown size={14} aria-hidden /> {cta.label}
            </Link>
          ) : cta.kind === "start" && ctaHref ? (
            <Link href={ctaHref} className="btn btn-primary">{cta.label}</Link>
          ) : (
            <p className="muted-2">{cta.label}</p>
          )}
        </div>

        <div className="course-landing-side-actions">
          <button type="button" className={`btn btn-ghost btn-compact${favorited ? " is-on" : ""}`} onClick={() => void toggleFavorite()} disabled={savingFav || preview} aria-pressed={favorited}>
            <Star size={14} fill={favorited ? "currentColor" : "none"} aria-hidden />
            {favorited ? "Favorito" : "Favoritar"}
          </button>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void share()}>
            <Share2 size={14} aria-hidden /> Compartilhar
          </button>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void copyLink()}>
            <Copy size={14} aria-hidden /> Copiar link
          </button>
        </div>
        {shareText ? <p className="muted-2" role="status">{shareText}</p> : null}

        <ul className="course-landing-includes">
          {course.instructorName ? <li>Instrutor: {course.instructorName}</li> : null}
          <li>Plano: {COURSE_PLAN_LABEL[course.requiredPlan] ?? course.requiredPlan}</li>
        </ul>
      </div>
    </aside>
  )
}
