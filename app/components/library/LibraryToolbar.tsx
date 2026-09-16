"use client"

import {
  Plus, X, Search, ChevronDown,
  Upload, Download, ListVideo, RefreshCw,
  Shuffle, Tag, Share2, FolderOpen, Link2,
} from "lucide-react"
import type { ActiveFilter, Category, Collection } from "@/app/components/library/types"
import { formatDuration } from "@/app/components/library/helpers"
import { avatar } from "@/app/components/library/helpers"
import { CategoryFilterBtn, CollectionChip } from "@/app/components/library/LibraryBits"

type Props = {
  search: string
  onSearch: (v: string) => void
  onRandom: () => void
  onImport: () => void
  onPlaylist: () => void
  onAddCategory: () => void
  onAddVideo: () => void
  onRefresh: () => void
  refreshing: boolean
  activeFilter: ActiveFilter
  activeCollection: number | null
  onFilter: (f: ActiveFilter) => void
  sharedCount: number
  categories: Category[]
  onDeleteCategory: (id: number) => void
  onRenameCategory: (id: number, name: string, color: string) => void
  totalSecs: number
  listTotal: number
  watchedCount: number
  videosLength: number
  order: string
  onOrder: (v: string) => void
  collections: Collection[]
  onNewCollection: () => void
  onOpenCollection: (id: number) => void
  onManageCollection: (col: Collection) => void
  onDeleteCollection: (id: number) => void
  currentCollection: Collection | null
  collectionVideoCount: number
  onCloseCollection: () => void
}

export function LibraryToolbar(p: Props) {
  return (
    <>
      <div className="toolbar">
        <div className="search-wrap search-wrap--wide">
          <Search size={14} className="search-ico" />
          <input className="input" value={p.search} onChange={(e) => p.onSearch(e.target.value)} placeholder="Buscar vídeos..." aria-label="Buscar vídeos" />
          {p.search && <button type="button" className="search-clear" onClick={() => p.onSearch("")} aria-label="Limpar busca"><X size={13} /></button>}
        </div>
        <button type="button" className="btn btn-primary" onClick={p.onAddVideo}><Plus size={16} /> Adicionar vídeo</button>
        <details className="toolbar-more">
          <summary className="btn btn-ghost">Mais opções <ChevronDown size={16} /></summary>
          <div className="toolbar-more-menu">
            <button type="button" className="btn btn-ghost" onClick={p.onPlaylist}><ListVideo size={16} /> Importar playlist</button>
            <button type="button" className="btn btn-ghost" onClick={p.onImport}><Upload size={16} /> Importar arquivo JSON</button>
            <button type="button" className="btn btn-ghost" onClick={() => window.open("/api/export", "_blank", "noopener")}><Download size={16} /> Exportar biblioteca</button>
            <button type="button" className="btn btn-ghost" onClick={p.onAddCategory}><Tag size={16} /> Nova categoria</button>
            <button type="button" className="btn btn-ghost" onClick={p.onRandom}><Shuffle size={16} /> Vídeo aleatório</button>
            <button type="button" className="btn btn-ghost" onClick={p.onRefresh} disabled={p.refreshing}><RefreshCw size={16} /> Atualizar</button>
          </div>
        </details>
      </div>

      <div className="toolbar">
        {(["all", "unwatched", "watched", "favorites"] as ActiveFilter[]).map((f) => {
          const labels: Record<string, string> = { all: "Todos", unwatched: "Não assistidos", watched: "Assistidos", favorites: "Favoritos" }
          const active = p.activeFilter === f && p.activeCollection === null
          return (
            <button key={f} type="button" onClick={() => p.onFilter(f)} className={`chip chip-accent${active ? " is-active" : ""}`}>
              {labels[f as string]}
            </button>
          )
        })}

        <button type="button" onClick={() => p.onFilter("shared")} className={`chip is-blue${p.activeFilter === "shared" && p.activeCollection === null ? " is-active" : ""}`}>
          <Share2 size={11} /> Comigo {p.sharedCount > 0 && `(${p.sharedCount})`}
        </button>

        <details className="category-filters"><summary className="chip">Categorias ({p.categories.length})</summary><div className="chip-row">
        {p.categories.map((cat) => (
          <CategoryFilterBtn
            key={cat.id}
            cat={cat}
            active={p.activeFilter === cat.id && p.activeCollection === null}
            onClick={() => p.onFilter(cat.id)}
            onDelete={() => p.onDeleteCategory(cat.id)}
            onRename={(n, c) => p.onRenameCategory(cat.id, n, c)}
          />
        ))}

        </div></details>

        <div className="row row-end">
          {p.totalSecs > 0 && <span className="toolbar-meta">⏱ {formatDuration(p.totalSecs)}</span>}
          {p.videosLength > 0 && (
            <span className="toolbar-meta">
              {p.activeCollection === null && p.activeFilter !== "shared"
                ? `${p.listTotal} vídeo${p.listTotal === 1 ? "" : "s"}`
                : `${p.watchedCount}/${p.videosLength} assistidos`}
            </span>
          )}
          <div className="select-wrap">
            <select className="select" value={p.order} onChange={(e) => p.onOrder(e.target.value)} aria-label="Ordenar">
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="az">A → Z</option>
              <option value="favorites">Favoritos</option>
              <option value="manual">Manual</option>
            </select>
            <ChevronDown size={12} className="select-ico" />
          </div>
        </div>
      </div>

      <div className="mb-section">
        <div className="section-label">
          <FolderOpen size={14} />
          Coleções
          <button type="button" className="btn btn-ghost" onClick={p.onNewCollection}>
            <Plus size={11} /> Nova
          </button>
        </div>
        {p.collections.length === 0 ? (
          <p className="muted-2">Nenhuma coleção ainda. Crie uma para agrupar vídeos e compartilhar com um link.</p>
        ) : (
          <div className="chip-row">
            {p.collections.map((col) => (
              <CollectionChip
                key={col.id}
                col={col}
                active={p.activeCollection === col.id}
                onClick={() => p.onOpenCollection(col.id)}
                onManage={() => p.onManageCollection(col)}
                onDelete={() => p.onDeleteCollection(col.id)}
              />
            ))}
          </div>
        )}
      </div>

      {p.currentCollection && (
        <div className="collection-head">
          <button type="button" className="icon-btn" onClick={p.onCloseCollection} aria-label="Fechar coleção"><X size={14} /></button>
          <h2 className="page-title collection-title">{p.currentCollection.name}</h2>
          {p.currentCollection.isPublic && (
            <span className="chip chip-accent is-active" title="Link público ativo">
              <Link2 size={11} /> Pública
            </span>
          )}
          {p.currentCollection.myRole === "owner" && (
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => p.onManageCollection(p.currentCollection!)}>
              <Link2 size={12} /> Link público
            </button>
          )}
          <span className="muted-2">{p.collectionVideoCount} vídeo(s)</span>
          <div className="row">
            {p.currentCollection.members.slice(0, 4).map((m) => (
              <div key={m.userId} title={m.user.name ?? m.user.email} className="avatar avatar--sm avatar--accent">
                {avatar(m.user)}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
