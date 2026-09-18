"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText, ImagePlus, Link2, Search, Upload } from "lucide-react"
import { Modal } from "@/app/components/Modal"
import { VideoThumb } from "@/app/components/VideoThumb"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import { hasCustomThumb } from "@/lib/course"
import { extractYouTubeId, getYouTubeThumbnail } from "@/lib/utils"
import { courseLessonArticleSchema, courseLessonYoutubeSchema } from "@/validators/course"
import type { LessonDraft, PickerVideo } from "@/app/components/admin/courses/types"

const LESSON_IMAGE_MAX_BYTES = 5 * 1024 * 1024

type Kind = "upload" | "youtube" | "article" | "library"
type Plan = "free" | "premium" | "pro"

type CreatedLesson = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  source: "youtube" | "upload" | "article"
  notes?: string | null
  status?: string
}

type YoutubeForm = {
  kind: "youtube"
  title: string
  url: string
  requiredPlan?: Plan
}

type ArticleForm = {
  kind: "article"
  title: string
  body: string
  requiredPlan?: Plan
}

type Props = {
  moduleTitle: string
  requiredPlan: Plan
  query: string
  onQueryChange: (q: string) => void
  videos: PickerVideo[]
  loading: boolean
  onPick: (video: PickerVideo) => void
  onCreated: (lesson: LessonDraft) => void
  onClose: () => void
  editing?: LessonDraft | null
  onEdited?: (lesson: LessonDraft) => void
}

function toDraft(video: CreatedLesson): LessonDraft {
  return {
    videoId: video.id,
    title: video.title,
    thumbnail: video.thumbnail,
    duration: video.duration,
    source: video.source,
    notes: video.notes ?? null,
    status: video.status,
  }
}

async function uploadLessonImage(videoId: number, file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return apiRequest<CreatedLesson>(`/api/admin/videos/${videoId}/image`, {
    method: "POST",
    body: formData,
  })
}

function uploadLesson(formData: FormData, onProgress: (pct: number) => void): Promise<CreatedLesson> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/admin/courses/lessons")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as CreatedLesson & { error?: string }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new Error(data.error ?? "Não foi possível enviar o vídeo"))
      } catch {
        reject(new Error("Resposta inválida do servidor"))
      }
    }
    xhr.onerror = () => reject(new Error("Erro de rede durante o upload"))
    xhr.send(formData)
  })
}

export function LessonCreateModal({
  moduleTitle,
  requiredPlan,
  query,
  onQueryChange,
  videos,
  loading,
  onPick,
  onCreated,
  onClose,
  editing = null,
  onEdited,
}: Props) {
  const isEdit = Boolean(editing)
  const [kind, setKind] = useState<Kind>(isEdit ? "article" : "upload")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [fileOver, setFileOver] = useState(false)
  const [uploadTitle, setUploadTitle] = useState("")
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageOver, setImageOver] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const youtubeForm = useForm<YoutubeForm>({
    resolver: zodResolver(courseLessonYoutubeSchema),
    defaultValues: { kind: "youtube", title: "", url: "", requiredPlan },
  })
  const articleForm = useForm<ArticleForm>({
    resolver: zodResolver(courseLessonArticleSchema),
    defaultValues: {
      kind: "article",
      title: editing?.title ?? "",
      body: editing?.notes ?? "",
      requiredPlan,
    },
  })

  const acceptFile = (picked: File | null) => {
    if (!picked) return
    const okType = /video\/(mp4|webm|quicktime)/.test(picked.type) || /\.(mp4|webm|mov)$/i.test(picked.name)
    if (!okType) {
      setError("Envie um vídeo MP4, WebM ou MOV")
      return
    }
    setError("")
    setFile(picked)
    if (!uploadTitle.trim()) setUploadTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "))
  }

  const acceptImage = (picked: File | null) => {
    if (!picked) return
    const okType = /image\/(jpeg|png|webp)/.test(picked.type) || /\.(jpe?g|png|webp)$/i.test(picked.name)
    if (!okType) {
      setError("Envie uma imagem JPEG, PNG ou WebP")
      return
    }
    if (picked.size > LESSON_IMAGE_MAX_BYTES) {
      setError("A imagem deve ter até 5 MB.")
      return
    }
    setError("")
    setRemoveImage(false)
    setImageFile(picked)
  }

  const clearImage = () => {
    setImageFile(null)
    setRemoveImage(true)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  const onYoutubeUrl = async (raw: string) => {
    youtubeForm.setValue("url", raw)
    const id = extractYouTubeId(raw)
    setUrlPreview(id ? getYouTubeThumbnail(id) : null)
    if (!id || youtubeForm.getValues("title").trim()) return
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(raw)}&format=json`)
      if (!res.ok) return
      const data = (await res.json()) as { title?: string }
      if (data.title) youtubeForm.setValue("title", data.title)
    } catch {
      // oembed é opcional
    }
  }

  const submitUpload = async () => {
    if (!file) {
      setError("Selecione um arquivo de vídeo")
      return
    }
    if (!uploadTitle.trim()) {
      setError("Título obrigatório")
      return
    }
    setBusy(true)
    setError("")
    const formData = new FormData()
    formData.append("title", uploadTitle.trim())
    formData.append("requiredPlan", requiredPlan)
    formData.append("file", file)
    try {
      const video = await uploadLesson(formData, setProgress)
      onCreated(toDraft(video))
    } catch (err) {
      setError(apiErrorMessage(err, err instanceof Error ? err.message : "Não foi possível enviar o vídeo"))
    } finally {
      setBusy(false)
    }
  }

  const submitYoutube = youtubeForm.handleSubmit(async (values) => {
    setBusy(true)
    setError("")
    try {
      const video = await apiRequest<CreatedLesson>("/api/admin/courses/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, requiredPlan }),
      })
      onCreated(toDraft(video))
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível adicionar o vídeo"))
    } finally {
      setBusy(false)
    }
  })

  const submitArticle = articleForm.handleSubmit(async (values) => {
    setBusy(true)
    setError("")
    try {
      if (editing && onEdited) {
        const updated = await apiRequest<CreatedLesson>(`/api/admin/videos/${editing.videoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: values.title, notes: values.body }),
        })
        let thumbnail = updated.thumbnail ?? editing.thumbnail
        if (imageFile) {
          const withImage = await uploadLessonImage(editing.videoId, imageFile)
          thumbnail = withImage.thumbnail
        } else if (removeImage && hasCustomThumb(editing.thumbnail)) {
          const cleared = await apiRequest<CreatedLesson>(`/api/admin/videos/${editing.videoId}/image`, {
            method: "DELETE",
          })
          thumbnail = cleared.thumbnail
        }
        onEdited({
          ...editing,
          title: updated.title,
          notes: updated.notes ?? values.body,
          thumbnail,
        })
      } else {
        let video = await apiRequest<CreatedLesson>("/api/admin/courses/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, requiredPlan }),
        })
        if (imageFile) {
          try {
            video = await uploadLessonImage(video.id, imageFile)
          } catch {
            // aula já existe; entra no módulo sem a foto pra poder editar depois
          }
        }
        onCreated(toDraft(video))
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o texto"))
    } finally {
      setBusy(false)
    }
  })

  const description = isEdit
    ? "Atualize o título, o material escrito e a imagem desta aula."
    : "Crie a aula agora: envie um arquivo, cole uma URL do YouTube ou escreva o material."
  const shownArticleThumb = imagePreview
    ?? (!removeImage && hasCustomThumb(editing?.thumbnail) ? editing?.thumbnail ?? null : null)

  return (
    <Modal open title={isEdit ? `Editar aula — ${moduleTitle}` : `Adicionar aula — ${moduleTitle}`} description={description} busy={busy} onClose={onClose}>
      {!isEdit && (
        <div className="tabs is-fill" role="tablist" aria-label="Tipo de aula">
          <button type="button" role="tab" aria-selected={kind === "upload"} className={`tab${kind === "upload" ? " is-active" : ""}`} disabled={busy} onClick={() => { setKind("upload"); setError("") }}>
            <Upload size={13} /> Arquivo
          </button>
          <button type="button" role="tab" aria-selected={kind === "youtube"} className={`tab${kind === "youtube" ? " is-active" : ""}`} disabled={busy} onClick={() => { setKind("youtube"); setError("") }}>
            <Link2 size={13} /> URL
          </button>
          <button type="button" role="tab" aria-selected={kind === "article"} className={`tab${kind === "article" ? " is-active" : ""}`} disabled={busy} onClick={() => { setKind("article"); setError("") }}>
            <FileText size={13} /> Texto
          </button>
          <button type="button" role="tab" aria-selected={kind === "library"} className={`tab${kind === "library" ? " is-active" : ""}`} disabled={busy} onClick={() => { setKind("library"); setError("") }}>
            <Search size={13} /> Já enviado
          </button>
        </div>
      )}

      {kind === "upload" && !isEdit && (
        <div className="stack-gap">
          <div className="field">
            <label className="field-label" htmlFor="lesson-video-file">Arquivo de vídeo</label>
            <input
              id="lesson-video-file"
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              disabled={busy}
              className="hidden-input"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className={`file-drop${fileOver ? " is-over" : ""}${file ? " is-on" : ""}`}
              disabled={busy}
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
            <label className="field-label" htmlFor="lesson-upload-title">Título</label>
            <input id="lesson-upload-title" className="input" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} disabled={busy} placeholder="Nome da aula" />
          </div>
          {busy && <p className="muted-2">Enviando... {progress}%</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void submitUpload()}>
            {busy ? "Enviando..." : "Adicionar vídeo"}
          </button>
        </div>
      )}

      {kind === "youtube" && !isEdit && (
        <form onSubmit={submitYoutube} className="stack-gap">
          <div className="field">
            <label className="field-label" htmlFor="lesson-youtube-url">URL do YouTube</label>
            <input
              id="lesson-youtube-url"
              className="input"
              placeholder="https://youtube.com/watch?v=..."
              disabled={busy}
              aria-invalid={Boolean(youtubeForm.formState.errors.url)}
              aria-describedby={youtubeForm.formState.errors.url ? "lesson-youtube-url-error" : undefined}
              {...youtubeForm.register("url", { onChange: (e) => void onYoutubeUrl(e.target.value) })}
            />
            {youtubeForm.formState.errors.url && (
              <p id="lesson-youtube-url-error" className="field-error" role="alert">{youtubeForm.formState.errors.url.message}</p>
            )}
          </div>
          {urlPreview && (
            <div className="preview-thumb">
              <VideoThumb src={urlPreview} alt="" sizes="440px" />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="lesson-youtube-title">Título</label>
            <input
              id="lesson-youtube-title"
              className="input"
              placeholder="Nome da aula"
              disabled={busy}
              aria-invalid={Boolean(youtubeForm.formState.errors.title)}
              aria-describedby={youtubeForm.formState.errors.title ? "lesson-youtube-title-error" : undefined}
              {...youtubeForm.register("title")}
            />
            {youtubeForm.formState.errors.title && (
              <p id="lesson-youtube-title-error" className="field-error" role="alert">{youtubeForm.formState.errors.title.message}</p>
            )}
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Adicionando..." : "Adicionar URL"}
          </button>
        </form>
      )}

      {(kind === "article" || isEdit) && (
        <form onSubmit={submitArticle} className="stack-gap">
          <div className="field">
            <label className="field-label" htmlFor="lesson-article-title">Título da aula</label>
            <input
              id="lesson-article-title"
              className="input"
              placeholder="Nome da aula"
              disabled={busy}
              aria-invalid={Boolean(articleForm.formState.errors.title)}
              aria-describedby={articleForm.formState.errors.title ? "lesson-article-title-error" : undefined}
              {...articleForm.register("title")}
            />
            {articleForm.formState.errors.title && (
              <p id="lesson-article-title-error" className="field-error" role="alert">{articleForm.formState.errors.title.message}</p>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lesson-article-body">Material escrito</label>
            <textarea
              id="lesson-article-body"
              className="textarea"
              rows={8}
              placeholder={"Título da seção\n\n01\nPasso: faça isto\n\nDica de Ouro: lembre deste detalhe"}
              disabled={busy}
              aria-invalid={Boolean(articleForm.formState.errors.body)}
              aria-describedby={articleForm.formState.errors.body ? "lesson-article-body-error" : undefined}
              {...articleForm.register("body")}
            />
            {articleForm.formState.errors.body && (
              <p id="lesson-article-body-error" className="field-error" role="alert">{articleForm.formState.errors.body.message}</p>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lesson-article-image">Imagem da aula</label>
            <p className="muted-2">Opcional. JPEG, PNG ou WebP até 5 MB.</p>
            <div className="stack-gap">
            <input
              id="lesson-article-image"
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={busy}
              className="hidden-input"
              onChange={(e) => acceptImage(e.target.files?.[0] ?? null)}
            />
            {shownArticleThumb && (
              <div className="preview-thumb">
                {shownArticleThumb.startsWith("blob:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownArticleThumb} alt="" />
                ) : (
                  <VideoThumb src={shownArticleThumb} alt="" sizes="440px" />
                )}
              </div>
            )}
            <button
              type="button"
              className={`file-drop${imageOver ? " is-over" : ""}${imageFile || shownArticleThumb ? " is-on" : ""}`}
              disabled={busy}
              onClick={() => imageInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setImageOver(true) }}
              onDragLeave={() => setImageOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setImageOver(false)
                acceptImage(e.dataTransfer.files[0] ?? null)
              }}
            >
              <ImagePlus size={22} />
              {imageFile ? (
                <>
                  <span className="file-drop-name">{imageFile.name}</span>
                  <span className="file-drop-hint">{(imageFile.size / 1024 / 1024).toFixed(1)} MB · clique para trocar</span>
                </>
              ) : shownArticleThumb ? (
                <>
                  <span className="file-drop-name">Clique para trocar a imagem</span>
                  <span className="file-drop-hint">ou arraste um JPEG, PNG ou WebP</span>
                </>
              ) : (
                <>
                  <span className="file-drop-name">Clique para selecionar uma imagem</span>
                  <span className="file-drop-hint">ou arraste um JPEG, PNG ou WebP</span>
                </>
              )}
            </button>
            {Boolean(imageFile || shownArticleThumb) && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={clearImage}>
                Remover imagem
              </button>
            )}
            </div>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Salvar texto" : "Adicionar aula de texto"}
          </button>
        </form>
      )}

      {kind === "library" && !isEdit && (
        <>
          <div className="search-wrap search-wrap--wide mb-section">
            <Search size={14} className="search-ico" />
            <input
              className="input"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Título da aula"
              aria-label="Buscar aula do catálogo"
              autoFocus
            />
          </div>
          {loading ? (
            <p className="muted-2">Carregando aulas...</p>
          ) : videos.length === 0 ? (
            <p className="muted-2">Nenhuma aula disponível. Envie um arquivo, cole uma URL ou escreva o texto.</p>
          ) : (
            <div className="catalog-grid">
              {videos.map((video) => (
                <button key={video.id} type="button" className="picker-tile" onClick={() => onPick(video)}>
                  <div className="picker-tile-thumb">
                    <VideoThumb src={video.thumbnail} alt={video.title} sizes="200px" />
                    {video.duration && <span className="thumb-time">{video.duration}</span>}
                  </div>
                  <div className="picker-tile-body">
                    <p className="picker-tile-title">{video.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
