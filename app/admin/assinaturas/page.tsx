"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/app/components/AppHeader"
import { RefreshCw, Crown, DollarSign, AlertTriangle, CheckCircle2, XCircle, Clock, RotateCcw, X, ChevronRight } from "lucide-react"

type Sub = {
  id: number
  userId: number
  plan: string
  billing: string
  amount: number
  startDate: string
  nextBillingDate: string
  status: string
  cancelledAt: string | null
  user: { id: number; name: string | null; email: string; status: string }
  payments: { id: number; amount: number; method: string; createdAt: string }[]
}

const PLAN_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  premium: { label: "Premium", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  pro:     { label: "Pro",     color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active:    { label: "Ativa",      color: "#16A34A", bg: "#F0FDF4", icon: <CheckCircle2 size={12}/> },
  overdue:   { label: "Vencida",    color: "#DC2626", bg: "#FEF2F2", icon: <AlertTriangle size={12}/> },
  cancelled: { label: "Cancelada",  color: "#64748B", bg: "#F8FAFC", icon: <XCircle size={12}/> },
  expired:   { label: "Expirada",   color: "#F97316", bg: "#FFF7ED", icon: <Clock size={12}/> },
}

const BILLING_LABEL: Record<string, string> = { monthly: "Mensal", annual: "Anual" }
const METHOD_LABEL:  Record<string, string> = { pix: "PIX", card: "Cartão", boleto: "Boleto", manual: "Manual" }

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function AssinaturasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [subs, setSubs]     = useState<Sub[]>([])
  const [loading, setLoad]  = useState(true)
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [msg, setMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  // Drawer de renovação/ação
  const [selected, setSelected] = useState<Sub | null>(null)
  const [action, setAction]     = useState<"renew" | "cancel" | "reactivate" | null>(null)
  const [actMethod, setActMethod] = useState("pix")
  const [actNote, setActNote]   = useState("")
  const [saving, setSaving]     = useState(false)

  const isAdmin = (session?.user as { role?: string })?.role === "admin"

  const fetchSubs = useCallback(async () => {
    setLoad(true)
    const res = await fetch("/api/admin/assinaturas")
    const data = await res.json()
    if (Array.isArray(data)) setSubs(data)
    setLoad(false)
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
    fetchSubs()
  }, [status, isAdmin, fetchSubs, router])

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500)
  }

  const doAction = async () => {
    if (!selected || !action) return
    setSaving(true)
    const res = await fetch(`/api/admin/assinaturas/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, method: actMethod, note: actNote || undefined }),
    })
    setSaving(false)
    if (res.ok) {
      flash(action === "renew" ? "Renovação registrada!" : action === "cancel" ? "Assinatura cancelada" : "Assinatura reativada!")
      setSelected(null); setAction(null); setActNote("")
      fetchSubs()
    } else flash("Erro ao executar ação", false)
  }

  const filtered = subs.filter(s => {
    const q = search.toLowerCase()
    const matchQ = !q || s.user.email.includes(q) || (s.user.name ?? "").toLowerCase().includes(q)
    const matchF = filter === "all" || s.status === filter
    return matchQ && matchF
  })

  const stats = {
    total:     subs.length,
    active:    subs.filter(s => s.status === "active").length,
    overdue:   subs.filter(s => s.status === "overdue").length,
    cancelled: subs.filter(s => s.status === "cancelled").length,
    mrr:       subs.filter(s => s.status === "active").reduce((acc, s) => acc + (s.billing === "annual" ? s.amount / 12 : s.amount), 0),
    arr:       subs.filter(s => s.status === "active").reduce((acc, s) => acc + (s.billing === "annual" ? s.amount : s.amount * 12), 0),
  }

  // Alertas: vencem em até 7 dias
  const upcoming = subs.filter(s => s.status === "active" && daysUntil(s.nextBillingDate) <= 7)

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div style={{ minHeight: "100vh", background: "#F1F5F9" }}><AppHeader /><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#64748B" }}>Carregando...</div></div>
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <AppHeader />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Gestão de Assinaturas</h1>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Controle vencimentos, renovações e cancelamentos</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.push("/admin")} style={{ padding: "8px 14px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", color: "#475569" }}>
              ← Admin
            </button>
            <button onClick={fetchSubs} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", color: "#475569" }}>
              <RefreshCw size={13}/> Atualizar
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, background: msg.ok ? "#F0FDF4" : "#FEF2F2", color: msg.ok ? "#15803D" : "#DC2626", border: `1px solid ${msg.ok ? "#BBF7D0" : "#FECACA"}`, fontSize: 13 }}>
            {msg.text}
          </div>
        )}

        {/* Alerta de vencimentos próximos */}
        {upcoming.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} color="#B45309"/>
            <p style={{ fontSize: 13, color: "#B45309", fontWeight: 600 }}>
              {upcoming.length} assinatura{upcoming.length > 1 ? "s" : ""} vence{upcoming.length > 1 ? "m" : ""} nos próximos 7 dias
            </p>
            <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
              {upcoming.map(s => (
                <span key={s.id} style={{ fontSize: 11, background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                  {s.user.name ?? s.user.email} — {daysUntil(s.nextBillingDate)}d
                </span>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Assinaturas ativas", value: stats.active,   color: "#16A34A", icon: <CheckCircle2 size={16}/> },
            { label: "Inadimplentes",      value: stats.overdue,  color: "#DC2626", icon: <AlertTriangle size={16}/> },
            { label: "Canceladas",         value: stats.cancelled,color: "#64748B", icon: <XCircle size={16}/> },
            { label: "MRR",                value: `R$ ${stats.mrr.toFixed(2)}`,  color: "#1E40AF", icon: <DollarSign size={16}/> },
            { label: "ARR",                value: `R$ ${stats.arr.toFixed(2)}`,  color: "#F97316", icon: <Crown size={16}/> },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: c.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: c.color, flexShrink: 0 }}>
                {c.icon}
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>{c.value}</p>
                <p style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..."
            style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }} />
          {["all","active","overdue","cancelled"].map(f => {
            const labels: Record<string,string> = { all:"Todos", active:"Ativos", overdue:"Vencidos", cancelled:"Cancelados" }
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "7px 14px", borderRadius: 8, border: `1px solid ${filter===f ? "#1E40AF" : "#E2E8F0"}`,
                background: filter===f ? "#EFF6FF" : "#fff", color: filter===f ? "#1E40AF" : "#64748B",
                fontSize: 13, fontWeight: filter===f ? 600 : 400, cursor: "pointer",
              }}>
                {labels[f]}
                {f !== "all" && <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700, color: f==="overdue" ? "#DC2626" : "inherit" }}>
                  ({subs.filter(s => s.status === f).length})
                </span>}
              </button>
            )
          })}
        </div>

        {/* Tabela */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Assinante","Plano","Cobrança","Valor","Início","Próx. vencimento","Status","Ações"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const ps  = PLAN_STYLE[s.plan] ?? PLAN_STYLE.premium
                const ss  = STATUS_STYLE[s.status] ?? STATUS_STYLE.active
                const days = daysUntil(s.nextBillingDate)
                const urgent = s.status === "active" && days <= 7
                return (
                  <tr key={s.id} style={{ borderBottom: i < filtered.length-1 ? "1px solid #F1F5F9" : "none", background: urgent ? "#FFFBEB" : "transparent" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{s.user.name ?? "—"}</p>
                      <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{s.user.email}</p>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ps.color, background: ps.bg, border: `1px solid ${ps.border}`, padding: "2px 8px", borderRadius: 20 }}>{ps.label}</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748B" }}>{BILLING_LABEL[s.billing]}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "#0F172A" }}>R$ {s.amount.toFixed(2)}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: "#94A3B8" }}>{fmtDate(s.startDate)}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: urgent ? "#B45309" : s.status === "overdue" ? "#DC2626" : "#0F172A" }}>
                        {fmtDate(s.nextBillingDate)}
                      </p>
                      {s.status === "active" && (
                        <p style={{ fontSize: 11, color: urgent ? "#B45309" : "#94A3B8", marginTop: 1 }}>
                          {days > 0 ? `em ${days} dia${days !== 1 ? "s" : ""}` : days === 0 ? "hoje" : `${Math.abs(days)}d atraso`}
                        </p>
                      )}
                      {s.status === "overdue" && (
                        <p style={{ fontSize: 11, color: "#DC2626", marginTop: 1 }}>{Math.abs(days)}d em atraso</p>
                      )}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: ss.color, background: ss.bg, padding: "3px 8px", borderRadius: 20 }}>
                        {ss.icon} {ss.label}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(s.status === "active" || s.status === "overdue") && (
                          <button onClick={() => { setSelected(s); setAction("renew"); setActMethod("pix"); setActNote("") }}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #BBF7D0", borderRadius: 6, background: "#F0FDF4", cursor: "pointer", color: "#16A34A", fontSize: 12, fontWeight: 600 }}>
                            <RotateCcw size={11}/> Renovar
                          </button>
                        )}
                        {s.status === "cancelled" && (
                          <button onClick={() => { setSelected(s); setAction("reactivate"); setActNote("") }}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "#EFF6FF", cursor: "pointer", color: "#1E40AF", fontSize: 12, fontWeight: 600 }}>
                            Reativar
                          </button>
                        )}
                        {s.status !== "cancelled" && (
                          <button onClick={() => { setSelected(s); setAction("cancel"); setActNote("") }}
                            style={{ padding: "5px 7px", border: "1px solid #FECACA", borderRadius: 6, background: "#FFF5F5", cursor: "pointer", color: "#DC2626", display: "flex" }}>
                            <X size={13}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  {subs.length === 0 ? "Nenhuma assinatura cadastrada ainda" : "Nenhuma assinatura encontrada"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de ação */}
      {selected && action && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "min(420px,100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {action === "renew" ? "Registrar Renovação" : action === "cancel" ? "Cancelar Assinatura" : "Reativar Assinatura"}
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
              {selected.user.name ?? selected.user.email} — {PLAN_STYLE[selected.plan]?.label} {BILLING_LABEL[selected.billing]}
            </p>

            {action === "renew" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 12, color: "#64748B" }}>Valor da renovação</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#16A34A" }}>R$ {selected.amount.toFixed(2)}</p>
                  <p style={{ fontSize: 11, color: "#94A3B8" }}>{BILLING_LABEL[selected.billing]}</p>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Forma de pagamento</label>
                  <select value={actMethod} onChange={e => setActMethod(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }}>
                    <option value="pix">PIX</option>
                    <option value="card">Cartão</option>
                    <option value="boleto">Boleto</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>Observação</label>
                  <input value={actNote} onChange={e => setActNote(e.target.value)} placeholder="Ex: comprovante PIX #txid..."
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none" }}/>
                </div>
              </div>
            )}

            {action === "cancel" && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "#DC2626" }}>O usuário voltará para o plano <strong>Free</strong> e perderá o acesso aos recursos pagos.</p>
              </div>
            )}

            {action === "reactivate" && (
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "#1E40AF" }}>A assinatura será reativada com o plano <strong>{PLAN_STYLE[selected.plan]?.label}</strong> e uma nova data de vencimento será calculada.</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setSelected(null); setAction(null) }}
                style={{ flex: 1, padding: "10px 0", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer", color: "#64748B" }}>
                Cancelar
              </button>
              <button onClick={doAction} disabled={saving}
                style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                  background: action === "cancel" ? "#DC2626" : "#1E40AF", color: "#fff" }}>
                {saving ? "Aguarde..." : action === "renew" ? "Confirmar renovação" : action === "cancel" ? "Confirmar cancelamento" : "Reativar assinatura"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
