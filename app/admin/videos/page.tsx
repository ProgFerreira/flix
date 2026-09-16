"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { Upload, Film, RefreshCw } from "lucide-react"
import { type AdminVideo, type Category } from "@/app/components/admin/videos/types"
import { AdminVideoGrid } from "@/app/components/admin/videos/VideoGrid"
import { UploadModal } from "@/app/components/admin/videos/UploadModal"
import { EditModal } from "@/app/components/admin/videos/EditModal"
import { type PickedUser } from "@/app/components/UserPicker"
import { usePlayer } from "@/app/contexts/PlayerContext"

function uploadVideo(formData: FormData, onProgress: (pct: number) => void): Promise<AdminVideo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/admin/videos/upload")
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(data)
      } catch { reject({ error: "Resposta inválida do servidor" }) }
    }
    xhr.onerror = () => reject({ error: "Erro de rede durante o upload" })
    xhr.send(formData)
  })
}

export default function AdminVideosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { play } = usePlayer()
  const isAdmin = (session?.user as { role?: string })?.role === "admin"

  const [page, setPage] = useState(1)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")

  const [title, setTitle] = useState("")
  const [channelName, setChannelName] = useState("")
  const [notes, setNotes] = useState("")
  const [requiredPlan, setRequiredPlan] = useState("free")
  const [published, setPublished] = useState(true)
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [viewers, setViewers] = useState<PickedUser[]>([])
  const [editVideo, setEditVideo] = useState<AdminVideo | null>(null)
  const [editViewers, setEditViewers] = useState<PickedUser[]>([])
  const [delConfirm, setDelConfirm] = useState<number | null>(null)

  const ready = status === "authenticated" && isAdmin

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const videosQuery = useQuery({
    queryKey: ["admin", "videos", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/videos?page=${page}`)
      if (!res.ok) throw new Error("Falha ao carregar vídeos")
      return res.json()
    },
    enabled: ready,
    refetchInterval: (query) => {
      const items = itemsFromPaginated<AdminVideo>(query.state.data)
      return items.some((v) => v.status === "processing") ? 4000 : false
    },
  })
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Falha ao carregar categorias")
      return res.json()
    },
    enabled: ready,
  })

  const videos = itemsFromPaginated<AdminVideo>(videosQuery.data)
  const meta = pageMeta(videosQuery.data)
  const categories: Category[] = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []
  const loading = videosQuery.isLoading || categoriesQuery.isLoading

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "videos"] })

  const resetForm = () => {
    setTitle(""); setChannelName(""); setNotes(""); setRequiredPlan("free")
    setPublished(true); setCategoryIds([]); setViewers([]); setError(""); setProgress(0)
  }

  const submitUpload = async (file: File | null) => {
    if (!file) { setError("Selecione um arquivo de vídeo"); return }
    if (!title.trim()) { setError("Título obrigatório"); return }

    setError(""); setUploading(true); setProgress(0)
    const form = new FormData()
    form.append("file", file)
    form.append("title", title.trim())
    if (channelName.trim()) form.append("channelName", channelName.trim())
    if (notes.trim()) form.append("notes", notes.trim())
    form.append("requiredPlan", requiredPlan)
    form.append("published", String(published))
    if (categoryIds.length) form.append("categoryIds", JSON.stringify(categoryIds))
    if (viewers.length) form.append("viewerIds", JSON.stringify(viewers.map((u) => u.id)))

    try {
      await uploadVideo(form, setProgress)
      setShowUpload(false); resetForm(); refresh()
    } catch (e) {
      setError((e as { error?: string })?.error ?? "Erro ao enviar vídeo")
    } finally {
      setUploading(false)
    }
  }

  const patchList = (updater: (items: AdminVideo[]) => AdminVideo[]) => {
    queryClient.setQueryData(["admin", "videos", page], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev
      const data = prev as { items?: AdminVideo[] }
      if (!Array.isArray(data.items)) return prev
      return { ...data, items: updater(data.items) }
    })
  }

  const togglePublished = async (v: AdminVideo) => {
    patchList((items) => items.map((x) => x.id === v.id ? { ...x, published: !x.published } : x))
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !v.published }),
    })
  }

  const changePlan = async (v: AdminVideo, plan: string) => {
    patchList((items) => items.map((x) => x.id === v.id ? { ...x, requiredPlan: plan } : x))
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiredPlan: plan }),
    })
  }

  const saveEdit = async () => {
    if (!editVideo) return
    setError("")
    const res = await fetch(`/api/admin/videos/${editVideo.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editVideo.title.trim(),
        channelName: editVideo.channelName?.trim() || undefined,
        notes: editVideo.notes?.trim() || undefined,
        requiredPlan: editVideo.requiredPlan,
        published: editVideo.published,
        viewerIds: editViewers.map((u) => u.id),
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? "Não foi possível salvar")
      return
    }
    const updated = await res.json()
    patchList((items) => items.map((x) => x.id === updated.id ? { ...x, ...updated } : x))
    setEditVideo(null)
  }

  const deleteVideo = async (id: number) => {
    await fetch(`/api/admin/videos/${id}`, { method: "DELETE" })
    await refresh()
    setDelConfirm(null)
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Vídeos Autorais</h1>
            <p className="page-sub">Faça upload dos seus vídeos e defina qual plano dá acesso a cada um</p>
          </div>
          <div className="page-head-actions">
            <button type="button" onClick={refresh} className="btn btn-ghost"><RefreshCw size={13} /> Atualizar</button>
            <button type="button" onClick={() => { resetForm(); setShowUpload(true) }} className="btn btn-accent"><Upload size={14} /> Novo vídeo</button>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="empty">
            <Film size={40} className="empty-icon" />
            <p>Nenhum vídeo autoral ainda</p>
            <p className="page-sub">Envie seu primeiro vídeo pra começar o catálogo</p>
          </div>
        ) : (
          <AdminVideoGrid
            videos={videos}
            page={meta.page}
            pageCount={meta.pageCount}
            total={meta.total}
            onPage={setPage}
            delConfirm={delConfirm}
            onWatch={(v) => play({ id: v.id, title: v.title, channelName: v.channelName, source: "upload", qualities: v.qualities })}
            onTogglePublished={togglePublished}
            onChangePlan={changePlan}
            onEdit={(v) => { setEditVideo(v); setEditViewers([]); setError("") }}
            onAskDelete={setDelConfirm}
            onConfirmDelete={deleteVideo}
            onCancelDelete={() => setDelConfirm(null)}
          />
        )}
      </main>

      {showUpload && (
        <UploadModal
          uploading={uploading}
          progress={progress}
          error={error}
          title={title}
          channelName={channelName}
          notes={notes}
          requiredPlan={requiredPlan}
          published={published}
          categoryIds={categoryIds}
          categories={categories}
          viewers={viewers}
          onClose={() => setShowUpload(false)}
          onTitle={setTitle}
          onChannelName={setChannelName}
          onNotes={setNotes}
          onRequiredPlan={setRequiredPlan}
          onPublished={setPublished}
          onCategoryIds={setCategoryIds}
          onViewers={setViewers}
          onSubmit={submitUpload}
        />
      )}

      {editVideo && (
        <EditModal
          video={editVideo}
          error={error}
          viewers={editViewers}
          onViewersChange={setEditViewers}
          onChange={setEditVideo}
          onClose={() => setEditVideo(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  )
}
