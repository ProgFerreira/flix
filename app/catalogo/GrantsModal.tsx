"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/app/components/Modal"
import { UserPicker, type PickedUser } from "@/app/components/UserPicker"

export function GrantsModal({
  videoId,
  title,
  onClose,
  onSaved,
}: {
  videoId: number
  title: string
  onClose: () => void
  onSaved: () => void
}) {
  const [viewers, setViewers] = useState<PickedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")


  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/catalog/${videoId}/grants`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((rows: PickedUser[]) => {
        if (!cancelled) setViewers(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar quem tem acesso extra")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [videoId])

  const save = async () => {
    setError("")
    setSaving(true)
    try {
    const res = await fetch(`/api/catalog/${videoId}/grants`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewerIds: viewers.map((u) => u.id) }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setError(typeof d?.error === "string" ? d.error : "Não foi possível salvar")
      return
    }
    onSaved()
    } catch { setError("Falha de conexão. Tente novamente.") }
    finally { setSaving(false) }
  }

  return (
<Modal open title="Quem pode ver" description={title} busy={saving} onClose={onClose}>
        {loading ? (
          <p className="muted">Carregando...</p>
        ) : (
          <div className="stack-gap">
            <UserPicker selected={viewers} onChange={setViewers} disabled={saving} />
            {error && <p className="field-error">{error}</p>}
            <button type="button" className="btn btn-accent btn-block" disabled={saving} onClick={save}>
              {saving ? "Salvando..." : "Salvar acesso"}
            </button>
          </div>
        )}
    </Modal>
  )
}
