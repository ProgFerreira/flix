"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export type PickedUser = { id: number; name: string | null; email: string; plan?: string }

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

function initial(user: PickedUser) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

export function UserPicker({
  selected,
  onChange,
  disabled,
  max = 50,
}: {
  selected: PickedUser[]
  onChange: (users: PickedUser[]) => void
  disabled?: boolean
  max?: number
}) {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [hits, setHits] = useState<PickedUser[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (debounced.length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    setSearching(true)
    fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: PickedUser[]) => {
        if (cancelled) return
        const taken = new Set(selected.map((u) => u.id))
        setHits(Array.isArray(rows) ? rows.filter((u) => !taken.has(u.id)) : [])
      })
      .catch(() => {
        if (!cancelled) setHits([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => { cancelled = true }
  }, [debounced, selected])

  const add = (user: PickedUser) => {
    if (disabled || selected.some((u) => u.id === user.id) || selected.length >= max) return
    onChange([...selected, user])
    setQ("")
    setHits([])
  }

  const remove = (id: number) => {
    if (disabled) return
    onChange(selected.filter((u) => u.id !== id))
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor="viewer-search">Quem mais pode ver (opcional)</label>
      <p className="muted-2">Quem tem o plano mínimo (ou superior) já assiste. A lista abaixo é só exceção.</p>
      <div className="invite-row">
        <input
          id="viewer-search"
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={disabled || selected.length >= max}
          placeholder="Buscar por nome ou e-mail"
          autoComplete="off"
        />
      </div>
      {searching && <p className="muted-2">Buscando...</p>}
      {hits.length > 0 && (
        <div className="pick-list picker-results">
          {hits.map((u) => (
            <button key={u.id} type="button" className="pick-item" disabled={disabled} onClick={() => add(u)}>
              <span className="avatar">{initial(u)}</span>
              <span className="list-row-body">
                <span className="list-row-title">{u.name || u.email}</span>
                <span className="list-row-email">{u.email}{u.plan ? ` · ${PLAN_LABEL[u.plan] ?? u.plan}` : ""}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div>
          <p className="kicker">Com acesso extra</p>
          {selected.map((u) => (
            <div key={u.id} className="list-row">
              <div className="avatar">{initial(u)}</div>
              <div className="list-row-body">
                <p className="list-row-title">{u.name || u.email}</p>
                <p className="list-row-email">{u.email}{u.plan ? ` · ${PLAN_LABEL[u.plan] ?? u.plan}` : ""}</p>
              </div>
              <button type="button" onClick={() => remove(u.id)} disabled={disabled} className="icon-btn" aria-label={`Remover ${u.name || u.email}`}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
