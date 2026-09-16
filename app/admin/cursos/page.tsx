"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import { BookOpen, Plus, RefreshCw } from "lucide-react"
import { CourseGrid } from "@/app/components/admin/courses/CourseGrid"
import { CreateCourseModal } from "@/app/components/admin/courses/CreateCourseModal"
import type { AdminCourse } from "@/app/components/admin/courses/types"

export default function AdminCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isAdmin = session?.user?.role === "admin"
  const ready = status === "authenticated" && isAdmin

  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState("")
  const [error, setError] = useState("")
  const [delId, setDelId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const query = useQuery({
    queryKey: ["admin", "courses", page],
    queryFn: () => apiRequest<{ items: AdminCourse[]; total: number; page: number; pageCount: number }>(`/api/admin/courses?page=${page}`),
    enabled: ready,
  })

  const courses = itemsFromPaginated<AdminCourse>(query.data)
  const meta = pageMeta(query.data)

  const createCourse = async (title: string) => {
    setCreating(true)
    setCreateError("")
    try {
      const created = await apiRequest<{ id: number }>("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      setShowCreate(false)
      await queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
      router.push(`/admin/cursos/${created.id}`)
    } catch (err) {
      setCreateError(apiErrorMessage(err, "Não foi possível criar o curso"))
    } finally {
      setCreating(false)
    }
  }

  const deleteCourse = async () => {
    if (delId == null) return
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/courses/${delId}`, { method: "DELETE" })
      setDelId(null)
      await queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível excluir o curso"))
    } finally {
      setDeleting(false)
    }
  }

  if (status === "loading" || (status === "authenticated" && query.isLoading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Cursos</h1>
            <p className="page-sub">Monte trilhas com módulos e aulas que já existem no catálogo</p>
          </div>
          <div className="page-head-actions">
            <button type="button" className="btn btn-ghost" onClick={() => query.refetch()}><RefreshCw size={13} /> Atualizar</button>
            <button type="button" className="btn btn-accent" onClick={() => { setShowCreate(true); setCreateError("") }}><Plus size={14} /> Novo curso</button>
          </div>
        </div>

        {error && <div className="alert alert-err" role="alert">{error}</div>}

        {courses.length === 0 ? (
          <div className="empty">
            <BookOpen size={40} className="empty-icon" />
            <p>Nenhum curso ainda</p>
            <p className="page-sub">Crie um curso e escolha aulas já enviadas em Vídeos autorais.</p>
          </div>
        ) : (
          <CourseGrid courses={courses} page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} onAskDelete={setDelId} />
        )}
      </main>

      {showCreate && (
        <CreateCourseModal creating={creating} error={createError} onClose={() => setShowCreate(false)} onCreate={createCourse} />
      )}

      <ConfirmDialog
        open={delId !== null}
        title="Excluir curso?"
        descricao="A trilha some do catálogo. As aulas continuam publicadas como avulsas."
        perigo
        carregando={deleting}
        confirmarLabel="Excluir curso"
        onCancel={() => setDelId(null)}
        onConfirm={() => void deleteCourse()}
      />
    </div>
  )
}
