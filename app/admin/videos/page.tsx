"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { AppHeader } from "@/app/components/AppHeader"
import { Upload, X, Trash2, Lock, Unlock, Film, RefreshCw, Loader2 } from "lucide-react"

type Category = { id: number; name: string; color: string }
type AdminVideo = {
  id: number; title: string; thumbnail: string
  channelName?: string | null; notes?: string | null
  requiredPlan: string; published: boolean; status: string
  fileSize?: number | null; createdAt: string
  videoCategories: { category: Category }[]
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const PLAN_COLOR: Record<string, string> = { free: "#64748B", premium: "#7C3AED", pro: "#B45309" }

function fmtSize(bytes?: number | null) {
  if (!bytes) return "—"
  const mb = bytes / 1024 / 1024
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

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
  const isAdmin = (session?.user as { role?: string })?.role === "admin"

  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [v, c] = await Promise.all([
      fetch("/api/admin/videos").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
    if (Array.isArray(v)) setVideos(v)
    if (Array.isArray(c)) setCategories(c)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
    fetchAll()
  }, [status, isAdmin, fetchAll, router])

  const resetForm = () => {
    setTitle(""); setChannelName(""); setNotes(""); setRequiredPlan("free")
    setPublished(true); setCategoryIds([]); setError(""); setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
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

    try {
      await uploadVideo(form, setProgress)
      setShowUpload(false); resetForm(); fetchAll()
    } catch (e) {
      setError((e as { error?: string })?.error ?? "Erro ao enviar vídeo")
    } finally {
      setUploading(false)
    }
  }

  const togglePublished = async (v: AdminVideo) => {
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, published: !x.published } : x))
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !v.published }),
    })
  }

  const changePlan = async (v: AdminVideo, plan: string) => {
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, requiredPlan: plan } : x))
    await fetch(`/api/admin/videos/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiredPlan: plan }),
    })
  }

  const [delConfirm, setDelConfirm] = useState<number | null>(null)
  const deleteVideo = async (id: number) => {
    await fetch(`/api/admin/videos/${id}`, { method: "DELETE" })
    setVideos((prev) => prev.filter((v) => v.id !== id))
    setDelConfirm(null)
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div style={{ minHeight: "100vh", background: "#F1F5F9" }}><AppHeader /><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#64748B" }}>Carregando...</div></div>
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <AppHeader />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Vídeos Autorais</h1>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Faça upload dos seus vídeos e defina qual plano dá acesso a cada um</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={fetchAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", color: "#475569" }}>
              <RefreshCw size={13} /> Atualizar
            </button>
            <button onClick={() => { resetForm(); setShowUpload(true) }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "none", borderRadius: 8, background: "#F97316", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" }}>
              <Upload size={14} /> Novo vídeo
            </button>
          </div>
        </div>

        {videos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
            <Film size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#64748B" }}>Nenhum vídeo autoral ainda</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Envie seu primeiro vídeo pra começar o catálogo</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {videos.map((v) => (
              <div key={v.id} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0", background: "#fff" }}>
                <div style={{ position: "relative", paddingBottom: "56.25%", background: "#0F172A" }}>
                  <Image src={v.thumbnail} alt={v.title} fill sizes="(max-width: 640px) 50vw, 240px" style={{ objectFit: "cover" }} />
                  <span style={{ position: "absolute", top: 6, left: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: v.published ? "rgba(22,163,74,0.9)" : "rgba(100,116,139,0.9)", color: "#fff" }}>
                    {v.published ? <Unlock size={9} /> : <Lock size={9} />} {v.published ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6, lineHeight: 1.35 }}>{v.title}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <select value={v.requiredPlan} onChange={(e) => changePlan(v, e.target.value)}
                      style={{ fontSize: 11, fontWeight: 700, color: PLAN_COLOR[v.requiredPlan], border: `1px solid ${PLAN_COLOR[v.requiredPlan]}40`, borderRadius: 20, padding: "2px 8px", background: "#fff", cursor: "pointer" }}>
                      {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}+</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>{fmtSize(v.fileSize)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => togglePublished(v)} style={{ flex: 1, fontSize: 12, padding: "6px 0", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", color: "#475569" }}>
                      {v.published ? "Despublicar" : "Publicar"}
                    </button>
                    {delConfirm === v.id ? (
                      <>
                        <button onClick={() => deleteVideo(v.id)} style={{ fontSize: 12, padding: "6px 10px", background: "#dc2626", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}>Sim</button>
                        <button onClick={() => setDelConfirm(null)} style={{ fontSize: 12, padding: "6px 10px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 6, color: "#64748B", cursor: "pointer" }}>Não</button>
                      </>
                    ) : (
                      <button onClick={() => setDelConfirm(v.id)} title="Excluir" style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #FECACA", background: "#FFF5F5", cursor: "pointer", color: "#DC2626", display: "flex" }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <div onClick={() => !uploading && setShowUpload(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 92vw)", background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #E2E8F0", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>Novo vídeo autoral</h2>
              {!uploading && <button onClick={() => setShowUpload(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Arquivo de vídeo (MP4, WebM ou MOV)</label>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" disabled={uploading}
                  style={{ width: "100%", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} placeholder="Nome do vídeo"
                  style={{ width: "100%", padding: "9px 12px", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 14, outline: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Plano mínimo</label>
                  <select value={requiredPlan} onChange={(e) => setRequiredPlan(e.target.value)} disabled={uploading}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 14 }}>
                    {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Status</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={uploading} />
                    Publicado
                  </label>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Categorias</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {categories.length === 0 ? <p style={{ fontSize: 12, color: "#94A3B8" }}>Nenhuma categoria criada.</p> : categories.map((c) => {
                    const on = categoryIds.includes(c.id)
                    return (
                      <button key={c.id} type="button" disabled={uploading}
                        onClick={() => setCategoryIds(on ? categoryIds.filter((id) => id !== c.id) : [...categoryIds, c.id])}
                        style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: `1px solid ${on ? c.color : "#E2E8F0"}`, background: on ? c.color + "18" : "transparent", color: on ? c.color : "#64748B", cursor: "pointer" }}>
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && <p style={{ fontSize: 13, color: "#dc2626" }}>{error}</p>}

              {uploading ? (
                <div>
                  <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "#F97316", transition: "width 0.2s" }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#64748B", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={12} className="animate-spin" /> Enviando... {progress}%
                  </p>
                </div>
              ) : (
                <button onClick={submitUpload} style={{ padding: "10px 0", background: "#F97316", border: "none", borderRadius: 7, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                  Enviar vídeo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
