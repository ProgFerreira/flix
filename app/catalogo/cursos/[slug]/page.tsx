import { CoursePageClient } from "./CoursePageClient"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ aula?: string; preview?: string }>
}

export default async function CoursePage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const aula = Number(query.aula)
  const lessonId = Number.isInteger(aula) && aula > 0 ? aula : null
  return <CoursePageClient slug={slug} lessonId={lessonId} preview={query.preview === "1"} />
}
