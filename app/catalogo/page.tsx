"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { AppHeader, VisitorHeader } from "@/app/components/AppHeader"
import { Pager } from "@/app/components/Pager"
import { useUrlState } from "@/app/hooks/useUrlState"
import { loginHref } from "@/lib/auth-redirect"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { PublishModal } from "@/app/catalogo/PublishModal"
import { GrantsModal } from "@/app/catalogo/GrantsModal"
import { CreatorShowcase } from "@/app/catalogo/CreatorShowcase"
import { ContinueWatching, type ContinueItem } from "@/app/catalogo/ContinueWatching"
import { CourseRail, type CatalogCourse } from "@/app/catalogo/CourseRail"
import { continueProgressPercent } from "@/lib/watch-continue"
import { Lock, Play, Film, Crown, Search, X, Star, Plus, Link2, Trash2, Users, Loader2 } from "lucide-react"
import { VideoThumb } from "@/app/components/VideoThumb"

type Category = { id: number; name: string; color: string }
type CatalogVideo = {
  id: number; title: string; thumbnail: string
  duration?: string | null; channelName?: string | null
  createdAt: string; requiredPlan: string; locked: boolean
  favorited?: boolean; progressSeconds?: number
  source: "youtube" | "upload" | "article"
  videoId?: string | null
  published: boolean
  mine?: boolean
  status?: string
  qualities?: string[]
  processError?: string | null
  videoCategories: { category: Category }[]
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const PLAN_COLOR: Record<string, string> = { free: "#64748B", premium: "#7C3AED", pro: "#B45309" }

function catalogProgressBar(seconds?: number, duration?: string | null) {
  return continueProgressPercent(seconds ?? 0, duration)
}

export default function CatalogoPage() {
  const { data: session, status } = useSession()
  const { play } = usePlayer()
  const queryClient = useQueryClient()
  const isLoggedIn = status === "authenticated"
  const isAdmin = session?.user?.role === "admin"

  const [search, setSearch] = useUrlState("q", "", v => v)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [planFilter, setPlanFilter] = useUrlState<"all" | "free" | "premium" | "pro">("plan", "all", v => v === "free" || v === "premium" || v === "pro" ? v : "all")
  const [onlyFav, setOnlyFav] = useUrlState("favorites", false, v => v === "true")
  const [onlyMine, setOnlyMine] = useUrlState("mine", false, v => v === "true")
  const [showPublish, setShowPublish] = useState(false)
  const [grantVideo, setGrantVideo] = useState<CatalogVideo | null>(null)
  const [delConfirm, setDelConfirm] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)
  const [page, setPage] = useUrlState("page", 1, v => Math.max(1, Math.floor(Number(v)) || 1))
  const [selectedVideo, setSelectedVideo] = useUrlState("video", "", v => /^\d+$/.test(v) ? v : "")
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4500)
    return () => clearTimeout(t)
  }, [flash])

  const catalogKey = ["catalog", page, debouncedSearch, planFilter, onlyFav, onlyMine, selectedVideo, status] as const
  const catalogQuery = useQuery({
    queryKey: catalogKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (selectedVideo) params.set("video", selectedVideo)
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      if (planFilter !== "all") params.set("plan", planFilter)
      if (onlyFav) params.set("favorited", "1")
      if (onlyMine) params.set("mine", "1")
      const res = await fetch(`/api/catalog?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar catálogo")
      return res.json()
    },
    enabled: status !== "loading",
    refetchInterval: (query) => {
      const items = itemsFromPaginated<CatalogVideo>(query.state.data)
      return items.some((v) => v.status === "processing") ? 4000 : false
    },
  })

  const coursesQuery = useQuery({
    queryKey: ["catalog-courses", planFilter, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (planFilter !== "all") params.set("plan", planFilter)
      const res = await fetch(`/api/catalog/courses?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar cursos")
      return res.json()
    },
    enabled: status !== "loading",
  })

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Falha ao carregar categorias")
      return res.json()
    },
    enabled: isLoggedIn,
  })

  const videos = itemsFromPaginated<CatalogVideo>(catalogQuery.data)
  const courses = itemsFromPaginated<CatalogCourse>(coursesQuery.data)
  const meta = pageMeta(catalogQuery.data)
  const categories: Category[] = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []
  const loading = catalogQuery.isLoading
  const hasFilters = Boolean(search || planFilter !== "all" || onlyFav || onlyMine || selectedVideo)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog"] })
    queryClient.invalidateQueries({ queryKey: ["catalog-continue"] })
    queryClient.invalidateQueries({ queryKey: ["catalog-courses"] })
  }

  const watch = (v: CatalogVideo | ContinueItem) => {
    if ("locked" in v && v.locked) return
    if ("status" in v && (v.status === "processing" || v.status === "error")) return
    play({
      id: v.id,
      title: v.title,
      channelName: v.channelName,
      source: v.source,
      videoId: v.videoId,
      startSeconds: v.progressSeconds,
      qualities: v.qualities,
    })
  }

  const toggleFav = async (e: React.MouseEvent, v: CatalogVideo) => {
    e.stopPropagation()
    if (!isLoggedIn || v.locked) return
    if (busyId !== null) return
    setBusyId(v.id)
    try {
    const res = await fetch(`/api/catalog/${v.id}/favorite`, { method: "PATCH" })
    if (!res.ok) throw new Error("Não foi possível atualizar o favorito.")
    const d = await res.json()
    queryClient.setQueryData(catalogKey, (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev
      const data = prev as { items?: CatalogVideo[] }
      if (!Array.isArray(data.items)) return prev
      return { ...data, items: data.items.map((x) => x.id === v.id ? { ...x, favorited: d.favorited } : x) }
    })
      if (onlyFav) refresh()
    } catch { setFlash({ text: "Não foi possível atualizar o favorito. Tente novamente.", ok: false }) }
    finally { setBusyId(null) }
  }

  const changePlan = async (v: CatalogVideo, plan: string) => {
    if (busyId !== null) return
    setBusyId(v.id)
    try {
      const res = await fetch(`/api/catalog/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredPlan: plan }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        setFlash({ text: typeof d?.error === "string" ? d.error : "Não foi possível atualizar o plano", ok: false })
        return
      }
      refresh()
    } catch { setFlash({ text: "Falha de conexão. Tente novamente.", ok: false }) }
    finally { setBusyId(null) }
  }

  const togglePublished = async (v: CatalogVideo) => {
    if (busyId !== null) return
    setBusyId(v.id)
    try {
    const res = await fetch(`/api/catalog/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !v.published }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setFlash({ text: typeof d?.error === "string" ? d.error : "Não foi possível atualizar", ok: false })
      return
    }
    refresh()
    } catch { setFlash({ text: "Falha de conexão. Tente novamente.", ok: false }) }
    finally { setBusyId(null) }
  }

  const deleteVideo = async (id: number) => {
    if (busyId !== null) return
    setBusyId(id)
    try {
    const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setFlash({ text: typeof d?.error === "string" ? d.error : "Não foi possível excluir", ok: false })
      return
    }
    setDelConfirm(null)
    refresh()
    } catch { setFlash({ text: "Falha de conexão. Tente novamente.", ok: false }) }
    finally { setBusyId(null) }
  }

  if (status === "loading") {
    return <div className="page">{isLoggedIn ? <AppHeader /> : <VisitorHeader />}<div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      {isLoggedIn ? <AppHeader /> : <VisitorHeader />}

      {flash && (
        <div className={`toast ${flash.ok ? "toast-ok" : "toast-err"}`} role="status">
          {flash.text}
          <button type="button" className="toast-close" onClick={() => setFlash(null)} aria-label="Fechar">×</button>
        </div>
      )}

      <main id="conteudo" className="page-wrap">
        {!isLoggedIn && <CreatorShowcase />}
        {isLoggedIn && <ContinueWatching onWatch={watch} />}
        <CourseRail courses={courses} />

        <div className="page-head is-mid" id="catalogo-lista">
          <div>
            <h1 className="page-title">{isLoggedIn ? "Catálogo" : "Catálogo do criador"}</h1>
            <p className="page-sub">
              {isLoggedIn
                ? isAdmin
                  ? "Publique aulas para os assinantes ou acompanhe o que já está no ar."
                  : "Assista às aulas do seu plano. Favoritos e progresso ficam na sua conta."
                : "Assista às aulas gratuitas sem conta. Assine Premium ou Pro para desbloquear o restante."}
            </p>
          </div>
          <div className="page-head-actions">
            {(meta.total > 0 || hasFilters) && (
              <div className="search-wrap">
                <Search size={14} className="search-ico" />
                <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou canal..." aria-label="Buscar no catálogo" />
                {search && (
                  <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="Limpar busca"><X size={13} /></button>
                )}
              </div>
            )}
            {isAdmin && (
              <button type="button" className="btn btn-accent" onClick={() => setShowPublish(true)}>
                <Plus size={14} /> Publicar
              </button>
            )}
          </div>
        </div>

        <div className="filter-row">
          {(["all", "free", "premium", "pro"] as const).map((p) => (
            <button key={p} type="button" className={`chip${planFilter === p ? " is-active" : ""}`} onClick={() => setPlanFilter(p)}>
              {p === "all" ? "Todos" : PLAN_LABEL[p]}
            </button>
          ))}
          {isLoggedIn && (
            <>
              <button type="button" className={`chip${onlyFav ? " is-active" : ""}`} onClick={() => setOnlyFav(!onlyFav)}>
                Favoritos
              </button>
              <button type="button" className={`chip${onlyMine ? " is-active" : ""}`} onClick={() => setOnlyMine(!onlyMine)}>
                Meus
              </button>
            </>
          )}
        </div>

        {!isLoggedIn && (
          <div className="banner">
            <Crown size={16} color="#1E40AF" />
            <p>
              Visitante vê o free. <Link href={loginHref("/catalogo", true)} className="link">Crie uma conta</Link> e peça Premium/Pro via PIX para assistir às aulas pagas.
            </p>
          </div>
        )}

        {selectedVideo && <div className="banner"><p>Conteúdo selecionado</p><button className="btn btn-ghost" onClick={() => setSelectedVideo("")}>Ver todo o catálogo</button></div>}
        {catalogQuery.isError ? <div className="alert alert-err" role="alert">Não foi possível carregar os vídeos. <button className="btn btn-ghost" onClick={() => catalogQuery.refetch()}>Tentar novamente</button></div> : loading ? <div className="catalog-grid" aria-busy="true" aria-label="Carregando vídeos">{Array.from({ length: 6 }, (_, i) => <div key={i} className="video-skeleton" />)}</div> : videos.length === 0 ? (
          <div className="empty">
            <Film size={40} className="empty-icon" />
            {hasFilters && <button className="btn btn-ghost" onClick={() => { setSearch(""); setPlanFilter("all"); setOnlyFav(false); setOnlyMine(false); setSelectedVideo("") }}>Limpar filtros</button>}
            <p>
              {meta.total === 0 && !hasFilters
                ? (courses.length > 0
                  ? "Nenhuma aula avulsa do seu plano"
                  : isAdmin
                    ? "Nenhum vídeo publicado ainda"
                    : "Nenhuma aula do seu plano. Veja Premium ou Pro para desbloquear o restante.")
                : "Nenhum vídeo encontrado"}
            </p>
            {isAdmin && meta.total === 0 && courses.length === 0 && !hasFilters && (
              <>
                <p className="page-sub">Publique um link do YouTube ou envie um arquivo MP4, WebM ou MOV.</p>
                <button type="button" className="btn btn-accent" onClick={() => setShowPublish(true)}>
                  <Plus size={14} /> Publicar o primeiro
                </button>
              </>
            )}
            {isLoggedIn && !isAdmin && meta.total === 0 && !hasFilters && (
              <p className="page-sub">Quando o criador publicar aulas, elas aparecem aqui conforme o seu plano.</p>
            )}
          </div>
        ) : (
          <div className="catalog-grid">
            {videos.map((v) => {
              const processing = v.status === "processing"
              const failed = v.status === "error"
              const blocked = v.locked || processing || failed
              const progressPct = catalogProgressBar(v.progressSeconds, v.duration)
              return (
              <div id={`video-${v.id}`} key={v.id} className={`video-card animate-fade-up${v.locked ? " is-locked" : ""}`}>
                <div
                  className={`video-card-thumb${v.locked || processing || failed ? " is-locked" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={v.locked ? `${v.title} (bloqueado)` : processing ? `${v.title} (processando)` : failed ? `${v.title} (falhou)` : `Assistir ${v.title}`}
                  onClick={() => watch(v)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); watch(v) } }}
                >
                  <VideoThumb src={v.thumbnail} alt={v.title} sizes="(max-width: 640px) 50vw, 220px" />
                  <div className="thumb-center">
                    {v.locked ? (
                      <div className="lock-msg">
                        <Lock size={22} />
                        <span className="lock-plan" style={{ ["--plan-color" as string]: PLAN_COLOR[v.requiredPlan] }}>
                          Exige {PLAN_LABEL[v.requiredPlan]}+
                        </span>
                      </div>
                    ) : processing ? (
                      <div className="lock-msg">
                        <Loader2 size={22} className="is-spinning" />
                        <span className="lock-plan" style={{ ["--plan-color" as string]: "#b45309" }}>Processando</span>
                      </div>
                    ) : failed ? (
                      <div className="lock-msg">
                        <span className="lock-plan" style={{ ["--plan-color" as string]: "#dc2626" }}>Falha no processamento</span>
                      </div>
                    ) : (
                      <div className="play-btn"><Play size={18} fill="#fff" color="#fff" /></div>
                    )}
                  </div>
                  {v.duration && <span className="thumb-time">{v.duration}</span>}
                  {!blocked && progressPct != null && (
                    <div className="thumb-progress" aria-hidden="true">
                      <span style={{ ["--bar-pct" as string]: `${progressPct}%` }} />
                    </div>
                  )}
                  <span className={`thumb-flag ${processing ? "is-warn" : failed ? "is-muted" : v.published ? "is-ok" : "is-muted"}`}>
                    {v.source === "youtube" ? <Link2 size={9} /> : <Film size={9} />}
                    {" "}{processing ? "Processando" : failed ? "Erro" : v.published ? (v.source === "youtube" ? "Link" : "Arquivo") : "Rascunho"}
                  </span>
                  {isLoggedIn && !blocked && (
                    <button
                      type="button"
                      title={v.favorited ? "Remover dos favoritos" : "Favoritar"}
                      aria-label={v.favorited ? "Remover dos favoritos" : "Favoritar"}
                      disabled={busyId !== null}
                      onKeyDown={e => e.stopPropagation()}
                      onClick={(e) => toggleFav(e, v)}
                      className={`fav-btn${v.favorited ? " is-on" : ""}`}
                    >
                      <Star size={14} fill={v.favorited ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>
                <div className="video-card-body">
                  <h3 className="video-card-title" title={v.title}>
                    {v.title.length > 58 ? v.title.slice(0, 58) + "…" : v.title}
                  </h3>
                  <div className="video-card-meta">
                    {v.mine && (
                      <select
                        className="plan-select"
                        data-plan={v.requiredPlan}
                        value={v.requiredPlan}
                        disabled={busyId !== null}
                        aria-label={`Plano mínimo de ${v.title}`}
                        onChange={(e) => void changePlan(v, e.target.value)}
                      >
                        {Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}+</option>)}
                      </select>
                    )}
                    {v.channelName && <span className="video-card-channel">{v.channelName}</span>}
                    {v.videoCategories.slice(0, 1).map((vc) => (
                      <span key={vc.category.id} className="cat-tag" style={{ ["--chip-color" as string]: vc.category.color }}>{vc.category.name}</span>
                    ))}
                  </div>
                  {v.mine && v.processError && (
                    <p className="field-error">{v.processError}</p>
                  )}
                  {v.locked && (
                    <Link href={isLoggedIn ? "/plano" : loginHref(`/catalogo?video=${v.id}`)} className="btn btn-upgrade">
                      <Crown size={12} /> {isLoggedIn ? `Assinar ${PLAN_LABEL[v.requiredPlan]}` : "Entrar pra assistir"}
                    </Link>
                  )}
                  {v.mine && (
                    <div className="admin-video-actions">
                      <button type="button" onClick={() => togglePublished(v)} className="btn btn-ghost" disabled={processing || busyId !== null}>
                        {v.published ? "Despublicar" : "Publicar"}
                      </button>
                      <button type="button" onClick={() => setGrantVideo(v)} className="icon-btn" aria-label="Quem pode ver" title="Quem pode ver">
                        <Users size={14} />
                      </button>
                      <button type="button" onClick={() => setDelConfirm(v.id)} className="icon-btn is-danger" aria-label={`Excluir ${v.title}`} disabled={busyId !== null}><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>

      <ConfirmDialog open={delConfirm !== null} title="Excluir vídeo?" descricao="O vídeo será removido permanentemente. Esta ação não pode ser desfeita." perigo carregando={busyId !== null} confirmarLabel="Excluir vídeo" onCancel={() => setDelConfirm(null)} onConfirm={() => { if (delConfirm !== null) void deleteVideo(delConfirm) }} />
      {grantVideo && (
        <GrantsModal
          videoId={grantVideo.id}
          title={grantVideo.title}
          onClose={() => setGrantVideo(null)}
          onSaved={() => { setGrantVideo(null); setFlash({ text: "Acesso extra atualizado", ok: true }) }}
        />
      )}
      {showPublish && (
        <PublishModal
          categories={categories}
          onClose={() => setShowPublish(false)}
          onPublished={() => { setShowPublish(false); setOnlyMine(true); refresh() }}
        />
      )}
    </div>
  )
}
