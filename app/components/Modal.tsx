"use client"

import { X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import { useRef, type ReactNode } from "react"

export function Modal({ open, title, description, busy = false, onClose, children }: {
  open: boolean; title: string; description: string; busy?: boolean
  onClose: () => void; children: ReactNode
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="modal dialog-content"
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement }}
        onCloseAutoFocus={(event) => { event.preventDefault(); previousFocus.current?.focus() }}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault() }}
        onInteractOutside={(event) => { if (busy) event.preventDefault() }}>
        <button type="button" className="icon-btn dialog-close" aria-label="Fechar diálogo" onClick={onClose} disabled={busy}><X size={18} /></button>
        <Dialog.Title className="modal-title">{title}</Dialog.Title>
        <Dialog.Description className="page-sub mb-section">{description}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
