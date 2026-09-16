"use client"

import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Image from "next/image"
import { Link2, Upload, Loader2 } from "lucide-react"
import { Modal } from "@/app/components/Modal"
import { UserPicker, type PickedUser } from "@/app/components/UserPicker"
import { extractYouTubeId } from "@/lib/utils"

type Category = { id: number; name: string; color: string }

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

const linkSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  channelName: z.string().max(120).optional(),
  duration: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]),
  published: z.boolean(),
})

type LinkForm = z.infer<typeof linkSchema>

function uploadVideo(formData: FormData, onProgress: (pct: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/catalog/upload")
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

export function PublishModal({
  categories,
  onClose,
  onPublished,
}: {
  categories: Category[]
  onClose: () => void
  onPublished: () => void
}) {
  const [kind, setKind] = useState<"link" | "file">("file")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [filePlan, setFilePlan] = useState<"free" | "premium" | "pro">("free")
  const [filePublished, setFilePublished] = useState(true)
  const [fileTitle, setFileTitle] = useState("")
  const [fileChannel, setFileChannel] = useState("")
  const [fileNotes, setFileNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileOver, setFileOver] = useState(false)
  const [viewers, setViewers] = useState<PickedUser[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<LinkForm>({
    resolver: zodResolver(linkSchema),
    defaultValues: { requiredPlan: "free", published: true, title: "", url: "" },
  })
  const requiredPlan = useWatch({ control: form.control, name: "requiredPlan" }) ?? "free"
  const published = useWatch({ control: form.control, name: "published" }) ?? true


  const onUrlChange = async (url: string) => {
    const id = extractYouTubeId(url)
    setUrlPreview(id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null)
    if (!id) return
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      if (!res.ok) return
      const d = await res.json()
      if (d.title && !form.getValues("title")) form.setValue("title", d.title)
      if (d.author_name && !form.getValues("channelName")) form.setValue("channelName", d.author_name)
    } catch {
      // oEmbed é só conveniência
    }
  }

  const submitLink = async (data: LinkForm) => {
    setError(""); setSaving(true)
    try {
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, categoryIds, viewerIds: viewers.map((u) => u.id) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setError(typeof d?.error === "string" ? d.error : "Não foi possível publicar o link")
      return
    }
    onPublished()
    } catch {
      setError("Não foi possível conectar. Seus dados foram mantidos; tente novamente.")
    } finally { setSaving(false) }
  }

  const acceptFile = (picked: File | null) => {
    if (!picked) return
    if (picked.size > 3 * 1024 ** 3) { setError("O arquivo deve ter no máximo 3 GB"); return }
    const okType = /video\/(mp4|webm|quicktime)/.test(picked.type) || /\.(mp4|webm|mov)$/i.test(picked.name)
    if (!okType) {
      setError("Envie um vídeo MP4, WebM ou MOV")
      return
    }
    setError("")
    setFile(picked)
    if (!fileTitle.trim()) {
      setFileTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "))
    }
  }

  const submitFile = async () => {
    if (!file) { setError("Selecione um arquivo de vídeo"); return }
    if (!fileTitle.trim()) { setError("Título obrigatório"); return }

    setError(""); setSaving(true); setProgress(0)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", fileTitle.trim())
    if (fileChannel.trim()) formData.append("channelName", fileChannel.trim())
    if (fileNotes.trim()) formData.append("notes", fileNotes.trim())
    formData.append("requiredPlan", filePlan)
    formData.append("published", String(filePublished))
    if (categoryIds.length) formData.append("categoryIds", JSON.stringify(categoryIds))
    if (viewers.length) formData.append("viewerIds", JSON.stringify(viewers.map((u) => u.id)))

    try {
      await uploadVideo(formData, setProgress)
      onPublished()
    } catch (e) {
      setError((e as { error?: string })?.error ?? "Erro ao enviar vídeo")
    } finally {
      setSaving(false)
    }
  }

  return (
<Modal open title="Publicar no catálogo" description="Adicione um link ou envie um arquivo. Escolha o plano necessário para assistir." busy={saving} onClose={onClose}>
        <div className="tabs is-fill" role="tablist">
          <button type="button" role="tab" aria-selected={kind === "link"} className={`tab${kind === "link" ? " is-active" : ""}`} disabled={saving} onClick={() => { setKind("link"); setError("") }}>
            <Link2 size={13} /> Link
          </button>
          <button type="button" role="tab" aria-selected={kind === "file"} className={`tab${kind === "file" ? " is-active" : ""}`} disabled={saving} onClick={() => { setKind("file"); setError("") }}>
            <Upload size={13} /> Arquivo
          </button>
        </div>

        {kind === "link" ? (
          <form onSubmit={form.handleSubmit(submitLink)} className="stack-gap">
            <div className="field">
              <label className="field-label" htmlFor="catalog-url">URL do YouTube</label>
              <input id="catalog-url" className="input" placeholder="https://youtube.com/watch?v=..." disabled={saving}
                aria-invalid={Boolean(form.formState.errors.url)}
                aria-describedby={form.formState.errors.url ? "catalog-url-error" : undefined}
                {...form.register("url", { onChange: (e) => onUrlChange(e.target.value) })} />
              {form.formState.errors.url && <p id="catalog-url-error" className="field-error" role="alert">{form.formState.errors.url.message}</p>}
            </div>
            {urlPreview && (
              <div className="preview-thumb">
                <Image src={urlPreview} alt="" fill sizes="440px" style={{ objectFit: "cover" }} />
              </div>
            )}
            <div className="field">
              <label className="field-label" htmlFor="catalog-title">Título</label>
              <input id="catalog-title" className="input" placeholder="Nome do vídeo" disabled={saving}
                aria-invalid={Boolean(form.formState.errors.title)}
                aria-describedby={form.formState.errors.title ? "catalog-title-error" : undefined}
                {...form.register("title")} />
              {form.formState.errors.title && <p id="catalog-title-error" className="field-error" role="alert">{form.formState.errors.title.message}</p>}
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="catalog-channel">Canal</label>
                <input id="catalog-channel" className="input" placeholder="Opcional" disabled={saving} {...form.register("channelName")} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="catalog-duration">Duração</label>
                <input id="catalog-duration" className="input" placeholder="5:32" disabled={saving} {...form.register("duration")} />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="catalog-notes">Notas</label>
              <textarea id="catalog-notes" className="textarea" rows={2} placeholder="Opcional" disabled={saving} {...form.register("notes")} />
            </div>
            <PublishMeta
              plan={requiredPlan}
              onPlan={(v) => form.setValue("requiredPlan", v)}
              published={published}
              onPublished={(v) => form.setValue("published", v)}
              categories={categories}
              categoryIds={categoryIds}
              onCategories={setCategoryIds}
              viewers={viewers}
              onViewers={setViewers}
              disabled={saving}
            />
            {error && <p className="field-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-accent btn-block" disabled={saving}>
              {saving ? "Publicando..." : "Publicar link"}
            </button>
          </form>
        ) : (
          <div className="stack-gap">
            <div className="field">
              <label className="field-label" htmlFor="publish-video-file">Arquivo de vídeo</label>
              <input
                id="publish-video-file"
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                disabled={saving}
                className="hidden-input"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={`file-drop${fileOver ? " is-over" : ""}${file ? " is-on" : ""}`}
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setFileOver(true) }}
                onDragLeave={() => setFileOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setFileOver(false)
                  acceptFile(e.dataTransfer.files[0] ?? null)
                }}
              >
                <Upload size={22} />
                {file ? (
                  <>
                    <span className="file-drop-name">{file.name}</span>
                    <span className="file-drop-hint">{(file.size / 1024 / 1024).toFixed(1)} MB · clique para trocar</span>
                  </>
                ) : (
                  <>
                    <span className="file-drop-name">Clique para selecionar o vídeo</span>
                    <span className="file-drop-hint">ou arraste um MP4, WebM ou MOV</span>
                  </>
                )}
              </button>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="file-title">Título</label>
              <input id="file-title" className="input" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} disabled={saving} placeholder="Nome do vídeo" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="file-channel">Canal (opcional)</label>
              <input id="file-channel" className="input" value={fileChannel} onChange={(e) => setFileChannel(e.target.value)} disabled={saving} placeholder="Nome do canal" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="file-notes">Notas (opcional)</label>
              <textarea id="file-notes" className="textarea" value={fileNotes} onChange={(e) => setFileNotes(e.target.value)} disabled={saving} rows={2} />
            </div>
            <PublishMeta
              plan={filePlan}
              onPlan={setFilePlan}
              published={filePublished}
              onPublished={setFilePublished}
              categories={categories}
              categoryIds={categoryIds}
              onCategories={setCategoryIds}
              viewers={viewers}
              onViewers={setViewers}
              disabled={saving}
            />
            {error && <p className="field-error" role="alert">{error}</p>}
            {saving ? (
              <div>
                <div className="progress-line"><span style={{ ["--bar-pct" as string]: `${progress}%` }} /></div>
                <p className="muted row"><Loader2 size={12} className="is-spinning" /> Enviando... {progress}%</p>
              </div>
            ) : (
              <button type="button" onClick={submitFile} className="btn btn-accent btn-block">Enviar vídeo</button>
            )}
          </div>
        )}
    </Modal>
  )
}

function PublishMeta({
  plan, onPlan, published, onPublished, categories, categoryIds, onCategories, viewers, onViewers, disabled,
}: {
  plan: string
  onPlan: (v: "free" | "premium" | "pro") => void
  published: boolean
  onPublished: (v: boolean) => void
  categories: Category[]
  categoryIds: number[]
  onCategories: (ids: number[]) => void
  viewers: PickedUser[]
  onViewers: (users: PickedUser[]) => void
  disabled: boolean
}) {
  return (
    <>
      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="catalog-plan">Plano mínimo</label>
          <select id="catalog-plan" className="select" value={plan} disabled={disabled} onChange={(e) => onPlan(e.target.value as "free" | "premium" | "pro")}>
            {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Status</label>
          <label className="check-box">
            <input type="checkbox" checked={published} onChange={(e) => onPublished(e.target.checked)} disabled={disabled} />
            Publicado
          </label>
        </div>
      </div>
      <UserPicker selected={viewers} onChange={onViewers} disabled={disabled} />
      <div className="field">
        <span className="field-label">Categorias</span>
        <div className="chip-row">
          {categories.length === 0 ? (
            <p className="muted-2">Nenhuma categoria criada na biblioteca.</p>
          ) : categories.map((c) => {
            const on = categoryIds.includes(c.id)
            return (
              <button key={c.id} type="button" disabled={disabled}
                onClick={() => onCategories(on ? categoryIds.filter((id) => id !== c.id) : [...categoryIds, c.id])}
                className={`chip is-colored${on ? " is-active" : ""}`} style={{ ["--chip-color" as string]: c.color }}>
                {c.name}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
