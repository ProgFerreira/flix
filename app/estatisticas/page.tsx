"use client"

import { useState, useEffect } from "react"
import { Clock, Star, Eye, Video, TrendingUp, Tag, Tv } from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"

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
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => {
      if (d && typeof d.total === "number") setStats(d)
    }).finally(() => setLoading(false))
  }, [])

  const watchedPct = stats && stats.total > 0 ? Math.round((stats.watched / stats.total) * 100) : 0
  const maxMonth = stats?.byMonth?.length ? Math.max(...stats.byMonth.map(b => b.count), 1) : 1
  const maxCat   = stats?.topCategories?.length ? Math.max(...stats.topCategories.map(c => c.count), 1) : 1
  const maxChan  = stats?.topChannels?.length ? Math.max(...stats.topChannels.map(c => c.count), 1) : 1
  const totalHours = stats ? Math.floor(stats.totalMinutes / 60) : 0
  const remainMins = stats ? stats.totalMinutes % 60 : 0
  const timeLabel = totalHours > 0 ? `${totalHours}h ${remainMins}min` : `${remainMins}min`

  return (
    <div style={{ background: "#f4f4f5", minHeight: "100vh" }}>
      <AppHeader />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", letterSpacing: "-0.3px" }}>Estatísticas</h1>
          <p style={{ fontSize: 13, color: "#71717a", marginTop: 4 }}>Resumo da sua biblioteca de vídeos</p>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ borderRadius: 12, height: 100 }} />)}
          </div>
        ) : !stats ? (
          <div style={{ textAlign: "center", padding: "80px 0", background: "#fff", borderRadius: 12, border: "1px solid #e4e4e7" }}>
            <p style={{ fontSize: 15, color: "#71717a" }}>Erro ao carregar estatísticas. Tente recarregar a página.</p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total de vídeos",  value: stats.total,    icon: <Video size={20} />,       accent: "#2563eb", bg: "#eff6ff" },
                { label: "Assistidos",        value: stats.watched,  icon: <Eye size={20} />,         accent: "#16a34a", bg: "#f0fdf4" },
                { label: "Favoritos",         value: stats.favorites,icon: <Star size={20} />,        accent: "#f59e0b", bg: "#fffbeb" },
                { label: "Tempo total",       value: timeLabel,      icon: <Clock size={20} />,       accent: "#e85d04", bg: "#fff7ed" },
              ].map(card => (
                <div key={card.label} style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.accent }}>
                    {card.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 26, fontWeight: 800, color: "#18181b", lineHeight: 1 }}>{card.value}</p>
                    <p style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <TrendingUp size={15} color="#16a34a" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Progresso de visualização</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#16a34a" }}>{watchedPct}%</span>
              </div>
              <div style={{ height: 10, background: "#f4f4f5", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${watchedPct}%`, height: "100%", background: "linear-gradient(90deg, #16a34a, #22c55e)", borderRadius: 5, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <span style={{ fontSize: 12, color: "#71717a" }}><strong style={{ color: "#16a34a" }}>{stats.watched}</strong> assistidos</span>
                <span style={{ fontSize: 12, color: "#71717a" }}><strong style={{ color: "#a1a1aa" }}>{stats.unwatched}</strong> restantes</span>
              </div>
            </div>

            {/* Categories + Channels */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {/* Top categories */}
              <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
                  <Tag size={14} color="#7c3aed" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Top categorias</span>
                </div>
                {(stats.topCategories ?? []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "#a1a1aa" }}>Nenhuma categoria ainda</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(stats.topCategories ?? []).map(cat => (
                      <div key={cat.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" }} />
                            <span style={{ fontSize: 13, color: "#18181b", fontWeight: 500 }}>{cat.name}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 600 }}>{cat.count}</span>
                        </div>
                        <div style={{ height: 6, background: "#f4f4f5", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${(cat.count / maxCat) * 100}%`, height: "100%", background: cat.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top channels */}
              <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
                  <Tv size={14} color="#0891b2" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Top canais</span>
                </div>
                {(stats.topChannels ?? []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "#a1a1aa" }}>Nenhum canal ainda</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(stats.topChannels ?? []).map((ch, i) => (
                      <div key={ch.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 18, height: 18, borderRadius: 4, background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#71717a", flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ fontSize: 13, color: "#18181b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{ch.name}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 600, flexShrink: 0 }}>{ch.count}</span>
                        </div>
                        <div style={{ height: 6, background: "#f4f4f5", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${(ch.count / maxChan) * 100}%`, height: "100%", background: "#0891b2", borderRadius: 3, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 20 }}>
                <TrendingUp size={14} color="#e85d04" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>Vídeos adicionados por mês</span>
              </div>
              {(stats.byMonth ?? []).length === 0 ? (
                <p style={{ fontSize: 13, color: "#a1a1aa" }}>Sem dados suficientes</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 4 }}>
                  {(stats.byMonth ?? []).map(b => {
                    const pct = Math.max((b.count / maxMonth) * 90, b.count > 0 ? 10 : 3)
                    return (
                      <div key={b.month} title={`${b.count} vídeo(s)`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: b.count > 0 ? "default" : undefined }}>
                        <span style={{ fontSize: 11, color: b.count > 0 ? "#18181b" : "transparent", fontWeight: 700 }}>{b.count}</span>
                        <div style={{ width: "100%", background: b.count > 0 ? "#e85d04" : "#f4f4f5", borderRadius: "5px 5px 0 0", height: `${pct}px`, transition: "height 0.6s ease", opacity: b.count > 0 ? 1 : 0.5 }} />
                        <span style={{ fontSize: 10, color: "#a1a1aa", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>{formatMonth(b.month)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
