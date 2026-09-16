"use client"

import { Modal } from "./Modal"

type ConfirmDialogProps = {
  open: boolean
  title: string
  descricao: string
  confirmarLabel?: string
  perigo?: boolean
  carregando?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  descricao,
  confirmarLabel = "Confirmar",
  perigo = false,
  carregando = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return <Modal open={open} title={title} description={descricao} busy={carregando} onClose={onCancel}>
    <div className="modal-actions">
      <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={carregando}>Cancelar</button>
      <button type="button" className={perigo ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={carregando}>
        {carregando ? "Aguarde..." : confirmarLabel}
      </button>
    </div>
  </Modal>
}
