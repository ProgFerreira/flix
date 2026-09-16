"use client"

import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import type { Category } from "@/app/components/admin/videos/types"
import { PLAN_LABEL } from "@/app/components/admin/videos/types"
import { UserPicker, type PickedUser } from "@/app/components/UserPicker"
import { Modal } from "@/app/components/Modal"

type Props = {
  uploading: boolean
  progress: number
  error: string
  title: string
  channelName: string
  notes: string
  requiredPlan: string
  published: boolean
  categoryIds: number[]
  categories: Category[]
  viewers: PickedUser[]
  onClose: () => void
  onTitle: (v: string) => void
  onChannelName: (v: string) => void
  onNotes: (v: string) => void
  onRequiredPlan: (v: string) => void
  onPublished: (v: boolean) => void
  onCategoryIds: (ids: number[]) => void
  onViewers: (users: PickedUser[]) => void
  onSubmit: (file: File | null) => void
}

export function UploadModal({
  uploading, progress, error, title, channelName, notes, requiredPlan, published,
  categoryIds, categories, viewers, onClose, onTitle, onChannelName, onNotes, onRequiredPlan,
  onPublished, onCategoryIds, onViewers, onSubmit,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileOver, setFileOver] = useState(false)
  const [fileError, setFileError] = useState("")

  const acceptFile = (picked: File | null) => {
    if (!picked) return
    const okType = /video\/(mp4|webm|quicktime)/.test(picked.type) || /\.(mp4|webm|mov)$/i.test(picked.name)
    if (!okType) {
      setFileError("Envie um vídeo MP4, WebM ou MOV")
      return
    }
    setFileError("")
    setFile(picked)
    if (!title.trim()) onTitle(picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "))
  }

  return (
    <Modal open title="Novo vídeo autoral" description="Envie um arquivo MP4, WebM ou MOV para o catálogo." busy={uploading} onClose={onClose}>
      <div className="stack-gap">
        <div className="field">
          <label className="field-label" htmlFor="upload-video-file">Arquivo de vídeo</label>
          <input
            id="upload-video-file"
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            disabled={uploading}
            className="hidden-input"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={`file-drop${fileOver ? " is-over" : ""}${file ? " is-on" : ""}`}
            disabled={uploading}
            aria-describedby={fileError ? "upload-video-file-error" : undefined}
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
          <label className="field-label" htmlFor="upload-video-title">Título</label>
          <input id="upload-video-title" className="input" value={title} onChange={(e) => onTitle(e.target.value)} disabled={uploading} placeholder="Nome do vídeo" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="upload-video-channel">Canal (opcional)</label>
          <input id="upload-video-channel" className="input" value={channelName} onChange={(e) => onChannelName(e.target.value)} disabled={uploading} placeholder="Nome do canal" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="upload-video-notes">Notas (opcional)</label>
          <textarea id="upload-video-notes" className="textarea" value={notes} onChange={(e) => onNotes(e.target.value)} disabled={uploading} placeholder="Descrição interna" rows={2} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="upload-video-plan">Plano mínimo</label>
            <select id="upload-video-plan" className="select" value={requiredPlan} onChange={(e) => onRequiredPlan(e.target.value)} disabled={uploading}>
              {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label" id="upload-video-status-label">Status</span>
            <label className="check-box">
              <input type="checkbox" checked={published} onChange={(e) => onPublished(e.target.checked)} disabled={uploading} aria-labelledby="upload-video-status-label" />
              Publicado
            </label>
          </div>
        </div>
        <UserPicker selected={viewers} onChange={onViewers} disabled={uploading} />
        <div className="field">
          <span className="field-label" id="upload-video-cats">Categorias</span>
          <div className="chip-row" role="group" aria-labelledby="upload-video-cats">
            {categories.length === 0 ? <p className="muted-2">Nenhuma categoria criada.</p> : categories.map((c) => {
              const on = categoryIds.includes(c.id)
              return (
                <button key={c.id} type="button" disabled={uploading}
                  onClick={() => onCategoryIds(on ? categoryIds.filter((id) => id !== c.id) : [...categoryIds, c.id])}
                  className={`chip is-colored${on ? " is-active" : ""}`} style={{ ["--chip-color" as string]: c.color }}>
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>
        {(fileError || error) && <p id="upload-video-file-error" className="field-error" role="alert">{fileError || error}</p>}
        {uploading ? (
          <div>
            <div className="progress-line"><span style={{ ["--bar-pct" as string]: `${progress}%` }} /></div>
            <p className="muted row" role="status"><Loader2 size={12} className="is-spinning" /> Enviando... {progress}%</p>
          </div>
        ) : (
          <button type="button" onClick={() => onSubmit(file)} className="btn btn-accent btn-block">
            Enviar vídeo
          </button>
        )}
      </div>
    </Modal>
  )
}
