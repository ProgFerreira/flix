"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd"
import { AppHeader } from "@/app/components/AppHeader"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { VideoThumb } from "@/app/components/VideoThumb"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import { slugifyCourseTitle } from "@/lib/course"
import { ModuleCard } from "@/app/components/admin/courses/ModuleCard"
import { LessonCreateModal } from "@/app/components/admin/courses/LessonCreateModal"
import type { LessonDraft, ModuleDraft, PickerVideo } from "@/app/components/admin/courses/types"
import { Check, ChevronLeft, Eye, Plus } from "lucide-react"

type CourseDetail = {
  id: number
  title: string
  slug: string
  description: string | null
  learnings: string | null
  thumbnail: string | null
  requiredPlan: "free" | "premium" | "pro"
  published: boolean
  sortOrder: number
  modules: { id: number; title: string; lessons: { video: LessonDraft & { id: number; source?: LessonDraft["source"]; notes?: string | null; status?: string } }[] }[]
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function AdminCourseEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.role === "admin"
  const courseId = Number(id)

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [learnings, setLearnings] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [requiredPlan, setRequiredPlan] = useState<"free" | "premium" | "pro">("free")
  const [published, setPublished] = useState(false)
  const [modules, setModules] = useState<ModuleDraft[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)
  const [pickerModule, setPickerModule] = useState<string | null>(null)
  const [pickerQ, setPickerQ] = useState("")
  const [editingLesson, setEditingLesson] = useState<{ moduleKey: string; lesson: LessonDraft } | null>(null)
  const [delOpen, setDelOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const hydratedId = useRef<number | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 3500)
    return () => clearTimeout(timer)
  }, [flash])

  const query = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => apiRequest<CourseDetail>(`/api/admin/courses/${courseId}`),
    enabled: status === "authenticated" && isAdmin && Number.isInteger(courseId) && courseId > 0,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!query.data || hydratedId.current === query.data.id) return
    hydratedId.current = query.data.id
    const course = query.data
    setTitle(course.title)
    setSlug(course.slug)
    setDescription(course.description ?? "")
    setLearnings(course.learnings ?? "")
    setThumbnail(course.thumbnail ?? "")
    setRequiredPlan(course.requiredPlan)
    setPublished(Boolean(course.published))
    setModules(course.modules.map((module) => ({
      key: String(module.id),
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        videoId: lesson.video.id,
        title: lesson.video.title,
        thumbnail: lesson.video.thumbnail,
        duration: lesson.video.duration,
        source: lesson.video.source,
        notes: lesson.video.notes ?? null,
        status: lesson.video.status,
      })),
    })))
  }, [query.data])

  const picker = useQuery({
    queryKey: ["admin", "course-videos", courseId, pickerQ],
    queryFn: () => {
      const params = new URLSearchParams({ courseId: String(courseId) })
      if (pickerQ.trim()) params.set("q", pickerQ.trim())
      return apiRequest<{ items: PickerVideo[] }>(`/api/admin/courses/videos?${params}`)
    },
    enabled: pickerModule !== null,
  })

  const selectedIds = new Set(modules.flatMap((module) => module.lessons.map((lesson) => lesson.videoId)))
  const totalLessons = modules.reduce((sum, module) => sum + module.lessons.length, 0)
  const activeModule = modules.find((module) => module.key === pickerModule) ?? null
  const pickerVideos = (picker.data?.items ?? []).filter((video) => !selectedIds.has(video.id))

  const saveAll = async () => {
    setSaving(true)
    setError("")
    setFlash(null)
    try {
      await apiRequest(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          learnings: learnings.trim() || null,
          thumbnail: thumbnail.trim() || null,
          requiredPlan,
          published,
        }),
      })
      await apiRequest(`/api/admin/courses/${courseId}/curriculum`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modules: modules.map((module) => ({
            title: module.title.trim() || "Módulo",
            lessons: module.lessons.map((lesson) => ({ videoId: lesson.videoId })),
          })),
        }),
      })
      hydratedId.current = null
      await queryClient.invalidateQueries({ queryKey: ["admin", "course", courseId] })
      await queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
      await queryClient.invalidateQueries({ queryKey: ["catalog-courses"] })
      await queryClient.invalidateQueries({ queryKey: ["catalog-course"] })
      setFlash({ text: "Curso salvo", ok: true })
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o curso"))
    } finally {
      setSaving(false)
    }
  }

  const deleteCourse = async () => {
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/courses/${courseId}`, { method: "DELETE" })
      await queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
      router.push("/admin/cursos")
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível excluir o curso"))
      setDeleting(false)
    }
  }

  const persistPublished = async (next: boolean) => {
    if (publishing || next === published) return
    setPublishing(true)
    setError("")
    setPublished(next)
    try {
      await apiRequest(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      })
      queryClient.setQueryData(["admin", "course", courseId], (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev
        return { ...prev, published: next }
      })
      await queryClient.invalidateQueries({ queryKey: ["admin", "courses"] })
      await queryClient.invalidateQueries({ queryKey: ["catalog-courses"] })
    } catch (err) {
      setPublished(!next)
      setError(apiErrorMessage(err, "Não foi possível atualizar a publicação"))
    } finally {
      setPublishing(false)
    }
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result
    if (!destination) return

    if (type === "MODULE") {
      if (source.index === destination.index) return
      setModules((current) => {
        const copy = [...current]
        const [moved] = copy.splice(source.index, 1)
        copy.splice(destination.index, 0, moved)
        return copy
      })
      return
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    setModules((current) => {
      const copy = current.map((module) => ({ ...module, lessons: [...module.lessons] }))
      const from = copy.find((module) => module.key === source.droppableId)
      const to = copy.find((module) => module.key === destination.droppableId)
      if (!from || !to) return current
      const [moved] = from.lessons.splice(source.index, 1)
      to.lessons.splice(destination.index, 0, moved)
      return copy
    })
  }

  const addLesson = (moduleKey: string, lesson: LessonDraft) => {
    if (selectedIds.has(lesson.videoId)) return
    setModules((current) => current.map((module) => (
      module.key === moduleKey
        ? { ...module, lessons: [...module.lessons, lesson] }
        : module
    )))
    setPickerModule(null)
    setPickerQ("")
  }

  const addPickedVideo = (moduleKey: string, video: PickerVideo) => {
    addLesson(moduleKey, {
      videoId: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      source: video.source,
      status: video.status,
    })
  }

  if (status === "loading" || query.isLoading) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  if (query.isError) {
    return (
      <div className="page">
        <AppHeader />
        <main id="conteudo" className="page-wrap">
          <div className="empty"><p>Curso não encontrado</p></div>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => router.push("/admin/cursos")}>
              <ChevronLeft size={14} /> Cursos
            </button>
            <h1 className="page-title">Editar curso</h1>
            <p className="page-sub">Monte a capa, os módulos e crie as aulas aqui — arquivo, URL do YouTube ou texto.</p>
          </div>
          <div className="page-head-actions">
            {slug.trim() && (
              <a href={`/catalogo/cursos/${encodeURIComponent(slug.trim())}?preview=1`} className="btn btn-ghost">
                <Eye size={14} /> Pré-visualizar
              </a>
            )}
            <button type="button" className="btn btn-danger-soft" onClick={() => setDelOpen(true)}>Excluir</button>
            <button
              type="button"
              className={`btn ${flash?.ok ? "btn-ok-soft" : "btn-primary"}`}
              disabled={saving}
              onClick={() => void saveAll()}
            >
              {saving ? "Salvando..." : flash?.ok ? (
                <><Check size={14} aria-hidden /> Curso salvo</>
              ) : "Salvar curso"}
            </button>
          </div>
        </div>

        {flash && (
          <div className={`toast ${flash.ok ? "toast-ok" : "toast-err"}`} role="status">
            {flash.text}
            <button type="button" className="toast-close" onClick={() => setFlash(null)} aria-label="Fechar">×</button>
          </div>
        )}

        {error && <div className="alert alert-err" role="alert">{error}</div>}
        {flash?.ok && <div className="alert alert-ok">{flash.text}</div>}

        <form className="card card-form" onSubmit={(e) => { e.preventDefault(); void saveAll() }}>
          <div className="course-cover-grid">
            <div className="course-cover-preview">
              <VideoThumb src={thumbnail} alt={title || "Capa do curso"} sizes="220px" />
            </div>
            <div className="stack-gap">
              <label className="field">
                <span className="field-label">Título</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (!slugTouched) setSlug(slugifyCourseTitle(e.target.value))
                  }}
                  maxLength={200}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Slug</span>
                <input className="input" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }} maxLength={80} />
              </label>
              <label className="field">
                <span className="field-label">Capa (URL ou caminho)</span>
                <input className="input" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} maxLength={500} />
              </label>
            </div>
          </div>

          <label className="field" style={{ marginTop: 16 }} htmlFor="course-description">
            <span className="field-label">Descrição</span>
            <textarea id="course-description" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
          </label>

          <label className="field" style={{ marginTop: 16 }} htmlFor="course-learnings">
            <span className="field-label">O que o aluno vai aprender</span>
            <textarea
              id="course-learnings"
              className="input"
              rows={5}
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              maxLength={4000}
              placeholder="Uma habilidade por linha"
            />
          </label>

          <div className="between" style={{ marginTop: 16, alignItems: "flex-start", gap: 16 }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Plano mínimo</span>
              <select className="select" value={requiredPlan} onChange={(e) => setRequiredPlan(e.target.value as "free" | "premium" | "pro")}>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="pro">Pro</option>
              </select>
            </label>
            <div className="field" style={{ flex: 1 }}>
              <span className="field-label">Status</span>
              <div className="choice-row" style={{ marginTop: 5 }} role="group" aria-label="Status do curso">
                <button
                  type="button"
                  className={`choice${!published ? " is-on" : ""}`}
                  disabled={publishing || saving}
                  onClick={() => void persistPublished(false)}
                >
                  Rascunho
                  <small>Não aparece no catálogo</small>
                </button>
                <button
                  type="button"
                  className={`choice${published ? " is-on" : ""}`}
                  disabled={publishing || saving}
                  onClick={() => void persistPublished(true)}
                >
                  Publicado
                  <small>Visível pros assinantes</small>
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="between mb-section" style={{ marginTop: 24 }}>
          <h2 className="kicker kicker-inline">Currículo · {totalLessons} {totalLessons === 1 ? "aula" : "aulas"}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setModules((current) => [...current, { key: newKey(), title: `Módulo ${current.length + 1}`, lessons: [] }])}>
            <Plus size={14} /> Adicionar módulo
          </button>
        </div>

        {modules.length === 0 ? (
          <div className="empty">
            <p>Nenhum módulo ainda</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="modules" type="MODULE">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="stack-gap">
                  {modules.map((module, index) => (
                    <ModuleCard
                      key={module.key}
                      module={module}
                      index={index}
                      onTitleChange={(value) => setModules((current) => current.map((row) => row.key === module.key ? { ...row, title: value } : row))}
                      onRemoveModule={() => setModules((current) => current.filter((row) => row.key !== module.key))}
                      onRemoveLesson={(videoId) => setModules((current) => current.map((row) => row.key === module.key ? { ...row, lessons: row.lessons.filter((item) => item.videoId !== videoId) } : row))}
                      onOpenPicker={() => { setPickerModule(module.key); setPickerQ(""); setEditingLesson(null) }}
                      onEditLesson={(videoId) => {
                        const lesson = module.lessons.find((item) => item.videoId === videoId)
                        if (!lesson) return
                        setPickerModule(module.key)
                        setEditingLesson({ moduleKey: module.key, lesson })
                      }}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </main>

      {activeModule && (
        <LessonCreateModal
          moduleTitle={activeModule.title}
          requiredPlan={requiredPlan}
          query={pickerQ}
          onQueryChange={setPickerQ}
          videos={pickerVideos}
          loading={picker.isLoading}
          onPick={(video) => addPickedVideo(activeModule.key, video)}
          onCreated={(lesson) => addLesson(activeModule.key, lesson)}
          editing={editingLesson?.moduleKey === activeModule.key ? editingLesson.lesson : null}
          onEdited={(lesson) => {
            setModules((current) => current.map((module) => (
              module.key === activeModule.key
                ? { ...module, lessons: module.lessons.map((item) => item.videoId === lesson.videoId ? lesson : item) }
                : module
            )))
            setEditingLesson(null)
            setPickerModule(null)
          }}
          onClose={() => { setPickerModule(null); setPickerQ(""); setEditingLesson(null) }}
        />
      )}

      <ConfirmDialog
        open={delOpen}
        title="Excluir curso?"
        descricao="A trilha some do catálogo. As aulas continuam publicadas como avulsas."
        perigo
        carregando={deleting}
        confirmarLabel="Excluir curso"
        onCancel={() => setDelOpen(false)}
        onConfirm={() => void deleteCourse()}
      />
    </div>
  )
}
