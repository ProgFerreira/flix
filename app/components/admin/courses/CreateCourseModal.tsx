"use client"

import { useState } from "react"
import { Modal } from "@/app/components/Modal"

type Props = {
  creating: boolean
  error: string
  onClose: () => void
  onCreate: (title: string) => void
}

export function CreateCourseModal({ creating, error, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("")

  return (
    <Modal open title="Novo curso" description="Dê um título ao curso. Você escolhe a capa e monta a trilha na tela seguinte." busy={creating} onClose={onClose}>
      <form className="stack-gap" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onCreate(title.trim()) }}>
        <label className="field">
          <span className="field-label">Título</span>
          <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        {error && <div className="alert alert-err" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={creating}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Criando..." : "Criar e montar trilha"}</button>
        </div>
      </form>
    </Modal>
  )
}
