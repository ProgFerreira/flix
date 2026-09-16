"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { BookOpen } from "lucide-react"
import { CourseClassroom, type ClassroomCourse } from "@/app/components/course/CourseClassroom"
import { CourseLanding } from "@/app/components/course/CourseLanding"

function CourseFallback({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="classroom">
      <div className="empty">
        <BookOpen size={40} className="empty-icon" />
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}

export function CoursePageClient({
  slug,
  lessonId,
  preview,
}: {
  slug: string
  lessonId: number | null
  preview: boolean
}) {
  const { status } = useSession()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  const query = useQuery({
    queryKey: ["catalog-course", slug, status],
    queryFn: async () => {
      const res = await fetch(`/api/catalog/courses/${slug}`)
      if (res.status === 404) throw new Error("not-found")
      if (!res.ok) throw new Error("Falha ao carregar o curso")
      return res.json() as Promise<ClassroomCourse>
    },
    enabled: ready && Boolean(slug) && status !== "loading",
    retry: false,
  })

  if (!ready || status === "loading" || query.isLoading) {
    return <CourseFallback message="Carregando..." />
  }

  if (query.isError || !query.data) {
    return (
      <CourseFallback
        message="Curso não encontrado"
        action={<Link href="/catalogo" className="btn btn-ghost">Voltar ao catálogo</Link>}
      />
    )
  }

  if (lessonId != null) {
    return <CourseClassroom course={query.data} lessonId={lessonId} preview={preview} />
  }

  return <CourseLanding course={query.data} preview={preview} />
}
