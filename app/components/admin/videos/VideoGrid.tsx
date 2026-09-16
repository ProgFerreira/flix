"use client"

import { Lock, Unlock, Trash2, Pencil, Play, Loader2 } from "lucide-react"
import { Pager } from "@/app/components/Pager"
import { VideoThumb } from "@/app/components/VideoThumb"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { type AdminVideo, PLAN_LABEL, fmtSize } from "@/app/components/admin/videos/types"

type Props = {
  videos: AdminVideo[]
  page: number
  pageCount: number
  total: number
  onPage: (p: number) => void
  delConfirm: number | null
  onWatch: (v: AdminVideo) => void
  onTogglePublished: (v: AdminVideo) => void
  onChangePlan: (v: AdminVideo, plan: string) => void
  onEdit: (v: AdminVideo) => void
  onAskDelete: (id: number) => void
  onConfirmDelete: (id: number) => void
  onCancelDelete: () => void
}

export function AdminVideoGrid(p: Props) {
  if (p.videos.length === 0) return null
  return (
    <>
      <div className="catalog-grid">
        {p.videos.map((v) => {
          const processing = v.status === "processing"
          const failed = v.status === "error"
          return (
          <article key={v.id} className="video-card">
            <div
              className={`video-card-thumb${processing || failed ? " is-locked" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={processing ? `${v.title} (processando)` : failed ? `${v.title} (falhou)` : `Assistir ${v.title}`}
              onClick={() => { if (!processing && !failed) p.onWatch(v) }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!processing && !failed) p.onWatch(v) } }}
            >
              <VideoThumb src={v.thumbnail} alt={v.title} sizes="(max-width: 640px) 50vw, 240px" />
              <div className="video-card-overlay">
                {processing ? (
                  <div className="lock-msg">
                    <Loader2 size={18} className="is-spinning" />
                  </div>
                ) : failed ? null : (
                  <div className="play-btn"><Play size={18} fill="#fff" color="#fff" /></div>
                )}
              </div>
              <span className={`thumb-flag ${processing ? "is-warn" : failed ? "is-muted" : v.published ? "is-ok" : "is-muted"}`}>
                {processing ? "Processando" : failed ? "Erro" : v.published ? <><Unlock size={9} /> Publicado</> : <><Lock size={9} /> Rascunho</>}
              </span>
            </div>
            <div className="video-card-body">
              <h3 className="video-card-title">{v.title}</h3>
              <div className="video-card-meta">
                <select className="plan-select" data-plan={v.requiredPlan} value={v.requiredPlan} onChange={(e) => p.onChangePlan(v, e.target.value)} aria-label={`Plano mínimo de ${v.title}`}>
                  {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}+</option>)}
                </select>
                <span className="text-xs">{fmtSize(v.fileSize)}</span>
              </div>
              {v.processError && <p className="field-error">{v.processError}</p>}
              <div className="admin-video-actions">
                <button type="button" onClick={() => p.onTogglePublished(v)} className="btn btn-ghost" disabled={processing}>{v.published ? "Despublicar" : "Publicar"}</button>
                <button type="button" onClick={() => p.onEdit(v)} title="Editar" className="icon-btn" aria-label="Editar"><Pencil size={14} /></button>
                <button type="button" onClick={() => p.onAskDelete(v.id)} title="Excluir" className="icon-btn is-danger" aria-label="Excluir"><Trash2 size={14} /></button>
              </div>
            </div>
          </article>
        )})}
      </div>
      <Pager page={p.page} pageCount={p.pageCount} total={p.total} onPage={p.onPage} />
      <ConfirmDialog
        open={p.delConfirm !== null}
        title="Excluir vídeo?"
        descricao={`"${p.videos.find((v) => v.id === p.delConfirm)?.title ?? "Este vídeo"}" será removido do catálogo.`}
        confirmarLabel="Excluir"
        perigo
        onCancel={p.onCancelDelete}
        onConfirm={() => { if (p.delConfirm !== null) p.onConfirmDelete(p.delConfirm) }}
      />
    </>
  )
}
