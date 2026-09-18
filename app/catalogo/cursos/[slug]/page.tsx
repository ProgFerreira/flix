import { Suspense } from "react"
import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { loadPublicCourseBySlug } from "@/lib/load-public-course"
import { CourseFallback } from "@/app/catalogo/cursos/[slug]/CourseFallback"

const CourseClassroom = dynamic(
  () => import("@/app/components/course/CourseClassroom").then((mod) => mod.CourseClassroom),
)
const CourseLanding = dynamic(
  () => import("@/app/components/course/CourseLanding").then((mod) => mod.CourseLanding),
)

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ aula?: string; preview?: string }>
}

async function CourseView({
  slug,
  lessonId,
  preview,
}: {
  slug: string
  lessonId: number | null
  preview: boolean
}) {
  const course = await loadPublicCourseBySlug(slug)
  if (!course) notFound()
  if (lessonId != null) {
    return <CourseClassroom course={course} lessonId={lessonId} preview={preview} />
  }
  return <CourseLanding course={course} preview={preview} />
}

export default async function CoursePage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const aula = Number(query.aula)
  const lessonId = Number.isInteger(aula) && aula > 0 ? aula : null
  const preview = query.preview === "1"
  return (
    <Suspense fallback={<CourseFallback message="Carregando..." />}>
      <CourseView slug={slug} lessonId={lessonId} preview={preview} />
    </Suspense>
  )
}
