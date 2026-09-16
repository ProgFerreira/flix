"use client"

import { Clock, Star, Eye, Video, TrendingUp, Tag, Tv } from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"
import { useRequireAuth } from "@/app/components/useRequireAuth"
import { useQuery } from "@tanstack/react-query"

type Stats = {
  total: number; watched: number; unwatched: number; favorites: number; totalMinutes: number
  topCategories: { name: string; count: number; color: string }[]
  topChannels: { name: string; count: number }[]
  byMonth: { month: string; count: number }[]
}

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
function formatMonth(m: string) {
  const [, mon] = m.split("-")
  return MONTH_NAMES[parseInt(mon ?? "1") - 1] ?? m
}

export default function EstatisticasPage() {
  const status = useRequireAuth()
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats")
      const d = await r.json()
      if (!d || typeof d.total !== "number") throw new Error("stats")
      return d as Stats
    },
    enabled: status === "authenticated",
  })
  const stats = statsQuery.data ?? null
  const loading = statsQuery.isLoading

  if (status === "loading" || status === "unauthenticated") {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  const watchedPct = stats && stats.total > 0 ? Math.round((stats.watched / stats.total) * 100) : 0
  const maxMonth = stats?.byMonth?.length ? Math.max(...stats.byMonth.map(b => b.count), 1) : 1
  const maxCat   = stats?.topCategories?.length ? Math.max(...stats.topCategories.map(c => c.count), 1) : 1
  const maxChan  = stats?.topChannels?.length ? Math.max(...stats.topChannels.map(c => c.count), 1) : 1
  const totalHours = stats ? Math.floor(stats.totalMinutes / 60) : 0
  const remainMins = stats ? stats.totalMinutes % 60 : 0
  const timeLabel = totalHours > 0 ? `${totalHours}h ${remainMins}min` : `${remainMins}min`

  return (
    <div className="page">
      <AppHeader />

      <main id="conteudo" className="page-wrap page-wrap--md">
        <div className="mb-section">
          <h1 className="page-title">Estatísticas</h1>
          <p className="page-sub">Resumo da sua biblioteca de vídeos</p>
        </div>

        {loading ? (
          <div className="stat-grid">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
          </div>
        ) : !stats ? (
          <div className="empty empty-card">
            <p>Erro ao carregar estatísticas. Tente recarregar a página.</p>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              {[
                { label: "Total de vídeos",  value: stats.total,     icon: <Video size={20} />,  color: "#2563eb" },
                { label: "Assistidos",        value: stats.watched,   icon: <Eye size={20} />,    color: "#16a34a" },
                { label: "Favoritos",         value: stats.favorites, icon: <Star size={20} />,   color: "#f59e0b" },
                { label: "Tempo total",       value: timeLabel,       icon: <Clock size={20} />,  color: "#e85d04" },
              ].map(card => (
                <div key={card.label} className="stat-card stat-card--stack">
                  <div className="stat-icon" style={{ ["--stat-color" as string]: card.color }}>{card.icon}</div>
                  <div>
                    <p className="stat-value">{card.value}</p>
                    <p className="stat-label">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-card panel-card--flush">
              <div className="between mb-section">
                <div className="stat-head">
                  <TrendingUp size={15} color="#16a34a" />
                  Progresso de visualização
                </div>
                <span className="stat-pct">{watchedPct}%</span>
              </div>
              <div className="bar-track bar-track--lg">
                <div className="bar-fill is-ok" style={{ ["--bar-pct" as string]: `${watchedPct}%` }} />
              </div>
              <div className="legend">
                <span className="muted"><strong className="is-ok">{stats.watched}</strong> assistidos</span>
                <span className="muted"><strong className="is-muted">{stats.unwatched}</strong> restantes</span>
              </div>
            </div>

            <div className="split-2">
              <div className="panel-card">
                <div className="stat-head"><Tag size={14} color="#7c3aed" /> Top categorias</div>
                {(stats.topCategories ?? []).length === 0 ? (
                  <p className="muted-2">Nenhuma categoria ainda</p>
                ) : (
                  <div className="bar-stack">
                    {(stats.topCategories ?? []).map(cat => (
                      <div key={cat.name}>
                        <div className="bar-item-head">
                          <div className="row">
                            <span className="dot" style={{ ["--chip-color" as string]: cat.color }} />
                            <span className="muted">{cat.name}</span>
                          </div>
                          <span className="muted-2">{cat.count}</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ ["--bar-pct" as string]: `${(cat.count / maxCat) * 100}%`, ["--bar-color" as string]: cat.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-card">
                <div className="stat-head"><Tv size={14} color="#0891b2" /> Top canais</div>
                {(stats.topChannels ?? []).length === 0 ? (
                  <p className="muted-2">Nenhum canal ainda</p>
                ) : (
                  <div className="bar-stack">
                    {(stats.topChannels ?? []).map((ch, i) => (
                      <div key={ch.name}>
                        <div className="bar-item-head">
                          <div className="row">
                            <span className="rank">{i + 1}</span>
                            <span className="muted truncate">{ch.name}</span>
                          </div>
                          <span className="muted-2">{ch.count}</span>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ ["--bar-pct" as string]: `${(ch.count / maxChan) * 100}%`, ["--bar-color" as string]: "#0891b2" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="panel-card">
              <div className="stat-head"><TrendingUp size={14} color="#e85d04" /> Vídeos adicionados por mês</div>
              {(stats.byMonth ?? []).length === 0 ? (
                <p className="muted-2">Sem dados suficientes</p>
              ) : (
                <div className="month-chart">
                  {(stats.byMonth ?? []).map(b => {
                    const h = Math.max((b.count / maxMonth) * 90, b.count > 0 ? 10 : 3)
                    return (
                      <div key={b.month} title={`${b.count} vídeo(s)`} className="month-col">
                        <span className={`month-count${b.count > 0 ? "" : " is-empty"}`}>{b.count}</span>
                        <div className="month-bar" style={{ ["--bar-h" as string]: `${h}px`, ["--bar-op" as string]: b.count > 0 ? "1" : "0.5" }} />
                        <span className="month-label">{formatMonth(b.month)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
