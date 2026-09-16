import { notFound } from "next/navigation"
import { CourseClassroom } from "@/app/components/course/CourseClassroom"
import { CourseLanding } from "@/app/components/course/CourseLanding"
import { loadPublicCourseBySlug } from "@/lib/load-public-course"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ aula?: string; preview?: string }>
}

export default async function CoursePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const aula = Number(query.aula)
  const lessonId = Number.isInteger(aula) && aula > 0 ? aula : null
  const course = await loadPublicCourseBySlug(slug)
  if (!course) notFound()
  const preview = query.preview === "1"
  if (lessonId != null) {
    return <CourseClassroom course={course} lessonId={lessonId} preview={preview} />
  }
  return <CourseLanding course={course} preview={preview} />
}
