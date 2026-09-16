"use client"

import Link from "next/link"
import { VideoThumb } from "@/app/components/VideoThumb"
import { BookOpen, Lock } from "lucide-react"

export type CatalogCourse = {
  id: number
  slug: string
  title: string
  thumbnail: string
  requiredPlan: string
  lessonCount: number
  completedCount: number
  progressPercent: number | null
  locked: boolean
  continueLesson: { id: number; title: string } | null
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const PLAN_COLOR: Record<string, string> = { free: "#64748B", premium: "#7C3AED", pro: "#B45309" }

export function CourseRail({ courses }: { courses: CatalogCourse[] }) {
  if (courses.length === 0) return null

  return (
    <section className="catalog-continue" aria-label="Cursos">
      <p className="kicker">Cursos</p>
      <div className="catalog-rail">
        {courses.map((course) => (
          <Link key={course.id} href={`/catalogo/cursos/${course.slug}`} className="video-card catalog-rail-card">
            <div className={`video-card-thumb${course.locked ? " is-locked" : ""}`}>
              <VideoThumb src={course.thumbnail} alt={course.title} sizes="220px" />
              <div className="thumb-center">
                {course.locked ? (
                  <div className="lock-msg">
                    <Lock size={22} />
                    <span className="lock-plan" style={{ ["--plan-color" as string]: PLAN_COLOR[course.requiredPlan] }}>
                      Exige {PLAN_LABEL[course.requiredPlan]}+
                    </span>
                  </div>
                ) : (
                  <div className="play-btn"><BookOpen size={18} color="#fff" /></div>
                )}
              </div>
              <span className="thumb-time">{course.lessonCount} {course.lessonCount === 1 ? "aula" : "aulas"}</span>
              {course.progressPercent != null && (
                <div className="thumb-progress" aria-hidden="true">
                  <span style={{ ["--bar-pct" as string]: `${course.progressPercent}%` }} />
                </div>
              )}
            </div>
            <div className="video-card-body">
              <h3 className="video-card-title" title={course.title}>
                {course.title.length > 48 ? course.title.slice(0, 48) + "…" : course.title}
              </h3>
              <div className="video-card-meta">
                <span className="muted-2">
                  {course.continueLesson ? `Continuar: ${course.continueLesson.title}` : PLAN_LABEL[course.requiredPlan]}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
