"use client"

import { useEffect, useState } from "react"
import type { AdminVideo } from "@/app/components/admin/videos/types"
import { UserPicker, type PickedUser } from "@/app/components/UserPicker"
import { Modal } from "@/app/components/Modal"

type Props = {
  video: AdminVideo
  error: string
  onChange: (v: AdminVideo) => void
  onViewersChange: (users: PickedUser[]) => void
  viewers: PickedUser[]
  onClose: () => void
  onSave: () => void
}

export function EditModal({ video, error, onChange, viewers, onViewersChange, onClose, onSave }: Props) {
  const [loadingGrants, setLoadingGrants] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingGrants(true)
    fetch(`/api/catalog/${video.id}/grants`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: PickedUser[]) => {
        if (!cancelled) onViewersChange(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) onViewersChange([])
      })
      .finally(() => {
        if (!cancelled) setLoadingGrants(false)
      })
    return () => { cancelled = true }
    // só recarrega ao abrir outro vídeo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id])

  return (
    <Modal open title="Editar vídeo" description="Atualize título, notas e quem pode assistir." onClose={onClose}>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onSave() }}>
        <div className="field">
          <label className="field-label" htmlFor="edit-video-title">Título</label>
          <input id="edit-video-title" className="input" value={video.title} onChange={(e) => onChange({ ...video, title: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="edit-video-channel">Canal</label>
          <input id="edit-video-channel" className="input" value={video.channelName ?? ""} onChange={(e) => onChange({ ...video, channelName: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="edit-video-notes">Notas</label>
          <textarea id="edit-video-notes" className="textarea" value={video.notes ?? ""} onChange={(e) => onChange({ ...video, notes: e.target.value })} rows={3} />
        </div>
        {loadingGrants ? <p className="muted-2">Carregando acesso extra...</p> : (
          <UserPicker selected={viewers} onChange={onViewersChange} />
        )}
        {error && <p className="alert alert-err" role="alert">{error}</p>}
        <button type="submit" className="btn btn-accent btn-block">Salvar alterações</button>
      </form>
    </Modal>
  )
}
