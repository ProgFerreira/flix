"use client"

import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react"
import Image from "next/image"
import {
  X, Play, Star, CheckCircle2, Pencil, Share2, FolderOpen,
  Users, Trash2, GripVertical, Link2,
} from "lucide-react"
import type { Category, Collection, Video } from "@/app/components/library/types"
import { PALETTE } from "@/app/components/library/types"
import { avatar } from "@/app/components/library/helpers"

export function CollectionChip({ col, active, onClick, onManage, onDelete }: {
  col: Collection; active: boolean; onClick: () => void; onManage: () => void; onDelete: () => void
}) {
  const [delConfirm, setDelConfirm] = useState(false)
  return (
    <div className="hover-row" onMouseLeave={() => setDelConfirm(false)}>
      <button type="button" onClick={onClick} className={`chip chip-accent${active ? " is-active" : ""}`}>
        <FolderOpen size={12} />
        {col.name}
        {col.isPublic && <Link2 size={11} aria-label="Link público" />}
        <span className="text-xs">{col._count.videos}</span>
        {col.members.slice(0, 3).map((m) => (
          <span key={m.userId} title={m.user.name ?? m.user.email} className={`avatar avatar--xs${active ? " avatar--accent" : ""}`}>
            {avatar(m.user)}
          </span>
        ))}
      </button>
      {(col.myRole === "owner" || col.myRole === "editor") && (
        <button type="button" className="btn btn-ghost btn-compact" onClick={onManage}>
          {col.myRole === "owner" ? <><Link2 size={12} /> Link público</> : <><Users size={12} /> Membros</>}
        </button>
      )}
      <span className="hover-actions">
        {col.myRole === "owner" && !delConfirm && <button type="button" className="icon-btn" onClick={() => setDelConfirm(true)} aria-label="Excluir"><X size={11} /></button>}
        {col.myRole === "owner" && delConfirm && <>
          <button type="button" className="btn-mini btn-mini-danger" onClick={onDelete}>Sim</button>
          <button type="button" className="btn-mini btn-mini-ghost" onClick={() => setDelConfirm(false)}>Não</button>
        </>}
      </span>
    </div>
  )
}

export function CategoryFilterBtn({ cat, active, onClick, onDelete, onRename }: {
  cat: Category; active: boolean; onClick: () => void; onDelete: () => void; onRename: (n: string, c: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(cat.name)
  const [editColor, setEditColor] = useState(cat.color)
  const [delConfirm, setDelConfirm] = useState(false)

  if (editing) return (
    <div className="chip-edit">
      {PALETTE.map(c => (
        <button key={c} type="button" className={`swatch swatch-sm${editColor === c ? " is-on" : ""}`} style={{ background: c, ["--chip-color" as string]: c }} onClick={() => setEditColor(c)} aria-label={c} />
      ))}
      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && editName.trim()) { onRename(editName.trim(), editColor); setEditing(false) } if (e.key === "Escape") setEditing(false) }} autoFocus />
      <button type="button" className="btn-mini btn-mini-ok" onClick={() => { if (editName.trim()) { onRename(editName.trim(), editColor); setEditing(false) } }}>OK</button>
      <button type="button" className="icon-btn" onClick={() => setEditing(false)} aria-label="Cancelar"><X size={11} /></button>
    </div>
  )

  return (
    <div className="hover-row" onMouseLeave={() => setDelConfirm(false)}>
      <button type="button" onClick={onClick} className={`chip is-colored${active ? " is-active" : ""}`} style={{ ["--chip-color" as string]: cat.color }}>
        <span className="chip-dot" />
        {cat.name}
        <span className="text-xs">{cat._count?.videoCategories ?? 0}</span>
      </button>
      <span className="hover-actions">
        {!delConfirm && <>
          <button type="button" className="icon-btn" onClick={() => { setEditing(true); setEditName(cat.name); setEditColor(cat.color) }} aria-label="Renomear"><Pencil size={11} /></button>
          <button type="button" className="icon-btn" onClick={() => setDelConfirm(true)} aria-label="Excluir"><X size={11} /></button>
        </>}
        {delConfirm && <>
          <button type="button" className="btn-mini btn-mini-danger" onClick={onDelete}>Sim</button>
          <button type="button" className="btn-mini btn-mini-ghost" onClick={() => setDelConfirm(false)}>Não</button>
        </>}
      </span>
    </div>
  )
}

function ActionBtn({ children, onClick, title, active, kind }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; kind?: "star" | "ok" | "danger" }) {
  const state = active && kind === "star" ? " is-star" : active && kind === "ok" ? " is-ok" : kind === "danger" ? " is-danger" : ""
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`action-btn${state}`}>
      {children}
    </button>
  )
}

export function VideoCard({ video, index, dragHandle, onWatch, onDelete, onEdit, onToggleWatched, onToggleFavorite, onShare, onAddToCollection, inCollection, sharedBy }: {
  video: Video; index: number; dragHandle?: React.HTMLAttributes<HTMLElement> | null
  onWatch: () => void; onDelete: () => void; onEdit?: () => void
  onToggleWatched: () => void; onToggleFavorite: () => void
  onShare?: () => void; onAddToCollection?: () => void
  inCollection: boolean; sharedBy?: { id: number; email: string; name?: string | null }
}) {
  const [delConfirm, setDelConfirm] = useState(false)
  const cats = video.videoCategories.map(vc => vc.category)

  return (
    <div className="animate-fade-up" style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, animationFillMode: "both" }}
      onMouseLeave={() => setDelConfirm(false)}>
      <article className={`video-card${video.watched ? " is-watched" : ""}`}>
        <div
          className="video-card-thumb"
          role="button"
          tabIndex={0}
          aria-label={`Assistir ${video.title}`}
          onClick={onWatch}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatch() } }}
        >
          <Image src={video.thumbnail} alt={video.title} fill sizes="(max-width: 640px) 50vw, 220px" style={{ objectFit: "cover" }} />
          <div className="video-card-overlay">
            <div className="play-btn"><Play size={18} fill="#fff" color="#fff" /></div>
          </div>
          {video.duration && <span className="thumb-time">{video.duration}</span>}
          {video.watched && <span className="thumb-flag is-ok"><CheckCircle2 size={9} /> Assistido</span>}
          {video.favorite && !video.watched && <span className="thumb-flag is-star">⭐</span>}
          {dragHandle && <span {...dragHandle} className="thumb-drag"><GripVertical size={12} color="#fff" /></span>}
        </div>
        <div className="video-card-body">
          {sharedBy && <p className="shared-by"><Share2 size={9} /> {sharedBy.name ?? sharedBy.email}</p>}
          <h3 className="video-card-title" title={video.title}>
            {video.title.length > 58 ? video.title.slice(0, 58) + "..." : video.title}
          </h3>
          <div className="video-card-meta">
            {video.channelName && <span className="video-card-channel">{video.channelName}</span>}
            {cats.slice(0, 1).map(c => <span key={c.id} className="cat-tag" style={{ ["--chip-color" as string]: c.color }}>{c.name}</span>)}
          </div>
          <div className="video-card-actions">
            <ActionBtn onClick={onToggleFavorite} title="Favorito" active={video.favorite} kind="star"><Star size={14} fill={video.favorite ? "currentColor" : "none"} /></ActionBtn>
            <ActionBtn onClick={onToggleWatched} title="Assistido" active={video.watched} kind="ok"><CheckCircle2 size={14} /></ActionBtn>
            {onEdit && <ActionBtn onClick={onEdit} title="Editar"><Pencil size={14} /></ActionBtn>}
            {onShare && <ActionBtn onClick={onShare} title="Compartilhar"><Share2 size={14} /></ActionBtn>}
            {onAddToCollection && <ActionBtn onClick={onAddToCollection} title="Adicionar à coleção"><FolderOpen size={14} /></ActionBtn>}
            {delConfirm
              ? <>
                  <button type="button" className="btn-mini btn-mini-danger" onClick={onDelete}>{inCollection ? "Remover" : "Sim"}</button>
                  <button type="button" className="btn-mini btn-mini-ghost" onClick={() => setDelConfirm(false)}>Não</button>
                </>
              : <ActionBtn onClick={() => setDelConfirm(true)} title={inCollection ? "Remover da coleção" : "Excluir"} kind="danger"><Trash2 size={14} /></ActionBtn>}
          </div>
        </div>
      </article>
    </div>
  )
}

export function CategoryPicker({ categories, selected, onChange }: { categories: Category[]; selected: number[]; onChange: (ids: number[]) => void }) {
  if (categories.length === 0) return <p className="muted-2">Nenhuma categoria criada.</p>
  return (
    <div className="chip-row">
      {categories.map(c => {
        const on = selected.includes(c.id)
        return (
          <button key={c.id} type="button" onClick={() => onChange(on ? selected.filter(id => id !== c.id) : [...selected, c.id])}
            className={`chip is-colored${on ? " is-active" : ""}`} style={{ ["--chip-color" as string]: c.color }}>
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  const generatedId = useId()
  const errorId = `${generatedId}-error`
  let controlId = generatedId
  let control: ReactNode = children
  if (isValidElement(children)) {
    const child = children as ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>
    controlId = child.props.id ?? generatedId
    control = cloneElement(child, {
      id: controlId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
    })
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor={controlId}>{label}</label>
      {control}
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
    </div>
  )
}
