"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { Modal } from "@/app/components/Modal"
import { Pager } from "@/app/components/Pager"
import { useFilterPage } from "@/app/hooks/useFilterPage"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import { RefreshCw, Crown, DollarSign, AlertTriangle, CheckCircle2, XCircle, Clock, RotateCcw, X } from "lucide-react"

type Sub = {
  id: number
  userId: number
  plan: string
  billing: string
  amount: number | string
  startDate: string
  nextBillingDate: string
  status: string
  cancelledAt: string | null
  user: { id: number; name: string | null; email: string; status: string }
  payments: { id: number; amount: number | string; method: string; createdAt: string }[]
}

const PLAN_LABEL: Record<string, string> = { premium: "Premium", pro: "Pro" }
const STATUS_META: Record<string, { label: string; icon: React.ReactNode }> = {
  active: { label: "Ativa", icon: <CheckCircle2 size={12} /> },
  overdue: { label: "Vencida", icon: <AlertTriangle size={12} /> },
  cancelled: { label: "Cancelada", icon: <XCircle size={12} /> },
  expired: { label: "Expirada", icon: <Clock size={12} /> },
}

const BILLING_LABEL: Record<string, string> = { monthly: "Mensal", annual: "Anual" }

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function PlanBadge({ plan }: { plan: string }) {
  const key = plan === "pro" ? "pro" : "premium"
  return <span className={`badge badge-${key}`}>{PLAN_LABEL[key]}</span>
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.active
  const cls = status === "overdue" || status === "cancelled" || status === "expired" ? status : "active"
  return <span className={`badge badge-${cls}`}>{meta.icon} {meta.label}</span>
}

export default function AssinaturasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const { page, setPage } = useFilterPage(`${debouncedSearch}|${filter}`)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [selected, setSelected] = useState<Sub | null>(null)
  const [action, setAction] = useState<"renew" | "cancel" | "reactivate" | null>(null)
  const [actMethod, setActMethod] = useState("pix")
  const [actNote, setActNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const isAdmin = (session?.user as { role?: string })?.role === "admin"
  const ready = status === "authenticated" && isAdmin

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const subsQuery = useQuery({
    queryKey: ["admin", "assinaturas", page, debouncedSearch, filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      if (filter !== "all") params.set("status", filter)
      return apiRequest<{
        items: Sub[]
        total: number
        page: number
        pageCount: number
        stats: { total: number; active: number; overdue: number; cancelled: number; mrr: number; arr: number }
        upcoming: Sub[]
      }>(`/api/admin/assinaturas?${params}`)
    },
    enabled: ready,
  })

  const subs = itemsFromPaginated<Sub>(subsQuery.data)
  const meta = pageMeta(subsQuery.data)
  const stats = subsQuery.data?.stats ?? { total: 0, active: 0, overdue: 0, cancelled: 0, mrr: 0, arr: 0 }
  const upcoming = subsQuery.data?.upcoming ?? []
  const loading = subsQuery.isLoading
  const fetchSubs = () => queryClient.invalidateQueries({ queryKey: ["admin"] })

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500)
  }

  const syncBilling = async () => {
    setSyncing(true)
    try {
      const d = await apiRequest<{ changed: number; upcomingSent: number; overdueSent: number }>(
        "/api/admin/billing/sync",
        { method: "POST" },
      )
      flash(`Sincronizado: ${d.changed} status · ${d.upcomingSent} lembretes de vencimento · ${d.overdueSent} de atraso`)
      fetchSubs()
    } catch (err) {
      flash(apiErrorMessage(err, "Falha ao sincronizar"), false)
    }
    setSyncing(false)
  }

  const doAction = async () => {
    if (!selected || !action) return
    setSaving(true)
    try {
      await apiRequest(`/api/admin/assinaturas/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, method: actMethod, note: actNote || undefined }),
      })
      flash(action === "renew" ? "Renovação registrada!" : action === "cancel" ? "Assinatura cancelada" : "Assinatura reativada!")
      setSelected(null); setAction(null); setActNote("")
      fetchSubs()
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao executar ação"), false)
    }
    setSaving(false)
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />

      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Gestão de Assinaturas</h1>
            <p className="page-sub">Controle vencimentos, renovações e cancelamentos</p>
          </div>
          <div className="page-head-actions">
            <button type="button" onClick={syncBilling} className="btn btn-primary" disabled={syncing}>
              {syncing ? "Sincronizando..." : "Atualizar vencidos e avisar"}
            </button>
            <button type="button" onClick={fetchSubs} className="btn btn-ghost"><RefreshCw size={13} /> Atualizar</button>
          </div>
        </div>

        {msg && (
          <div className={`alert mb-section ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>
        )}

        {upcoming.length > 0 && (
          <div className="alert-banner banner-warn">
            <AlertTriangle size={16} />
            <p>
              {upcoming.length} assinatura{upcoming.length > 1 ? "s" : ""} vence{upcoming.length > 1 ? "m" : ""} nos próximos 7 dias
            </p>
            <div className="chip-row">
              {upcoming.map(s => (
                <span key={s.id} className="badge badge-warn">
                  {s.user.name ?? s.user.email} — {daysUntil(s.nextBillingDate)}d
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="stat-grid">
          {[
            { label: "Assinaturas ativas", value: stats.active, color: "#16A34A", icon: <CheckCircle2 size={16} /> },
            { label: "Inadimplentes", value: stats.overdue, color: "#DC2626", icon: <AlertTriangle size={16} /> },
            { label: "Canceladas", value: stats.cancelled, color: "#64748B", icon: <XCircle size={16} /> },
            { label: "MRR", value: `R$ ${formatMoney(stats.mrr)}`, color: "#1E40AF", icon: <DollarSign size={16} /> },
            { label: "ARR", value: `R$ ${formatMoney(stats.arr)}`, color: "#F97316", icon: <Crown size={16} /> },
          ].map(c => (
            <div key={c.label} className="stat-card">
              <div className="stat-icon" style={{ ["--stat-color" as string]: c.color }}>{c.icon}</div>
              <div>
                <p className="stat-value">{c.value}</p>
                <p className="stat-label">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." aria-label="Buscar assinantes" />
          {["all", "active", "overdue", "cancelled"].map(f => {
            const labels: Record<string, string> = { all: "Todos", active: "Ativos", overdue: "Vencidos", cancelled: "Cancelados" }
            return (
              <button type="button" key={f} onClick={() => setFilter(f)} className={`chip is-blue${filter === f ? " is-active" : ""}`}>
                {labels[f]}
                {f !== "all" && (
                  <span className={`filter-count${f === "overdue" ? " is-err" : ""}`}>
                    ({f === "active" ? stats.active : f === "overdue" ? stats.overdue : stats.cancelled})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {["Assinante", "Plano", "Cobrança", "Valor", "Início", "Próx. vencimento", "Status", "Ações"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const days = daysUntil(s.nextBillingDate)
                const urgent = s.status === "active" && days <= 7
                const dueCls = urgent ? "is-warn" : s.status === "overdue" ? "is-err" : ""
                return (
                  <tr key={s.id} className={urgent ? "is-warn" : undefined}>
                    <td>
                      <p className="cell-title">{s.user.name ?? "—"}</p>
                      <p className="cell-sub">{s.user.email}</p>
                    </td>
                    <td><PlanBadge plan={s.plan} /></td>
                    <td>{BILLING_LABEL[s.billing]}</td>
                    <td className="cell-title">R$ {formatMoney(s.amount)}</td>
                    <td className="cell-sub">{fmtDate(s.startDate)}</td>
                    <td>
                      <p className={`due-date ${dueCls}`}>{fmtDate(s.nextBillingDate)}</p>
                      {s.status === "active" && (
                        <p className={`due-sub ${urgent ? "is-warn" : ""}`}>
                          {days > 0 ? `em ${days} dia${days !== 1 ? "s" : ""}` : days === 0 ? "hoje" : `${Math.abs(days)}d atraso`}
                        </p>
                      )}
                      {s.status === "overdue" && (
                        <p className="due-sub is-err">{Math.abs(days)}d em atraso</p>
                      )}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div className="table-actions">
                        {(s.status === "active" || s.status === "overdue") && (
                          <button type="button" onClick={() => { setSelected(s); setAction("renew"); setActMethod("pix"); setActNote("") }} className="btn btn-ok-soft btn-compact">
                            <RotateCcw size={11} /> Renovar
                          </button>
                        )}
                        {s.status === "cancelled" && (
                          <button type="button" onClick={() => { setSelected(s); setAction("reactivate"); setActNote("") }} className="btn btn-primary-soft btn-compact">
                            Reativar
                          </button>
                        )}
                        {s.status !== "cancelled" && (
                          <button type="button" onClick={() => { setSelected(s); setAction("cancel"); setActNote("") }} className="icon-btn is-danger" aria-label="Cancelar assinatura">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={8} className="cell-empty">
                    {meta.total === 0 ? "Nenhuma assinatura cadastrada ainda" : "Nenhuma assinatura encontrada"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>

      {selected && action && (
        <Modal
          open
          title={action === "renew" ? "Registrar Renovação" : action === "cancel" ? "Cancelar Assinatura" : "Reativar Assinatura"}
          description={`${selected.user.name ?? selected.user.email} — ${PLAN_LABEL[selected.plan] ?? selected.plan} ${BILLING_LABEL[selected.billing]}`}
          busy={saving}
          onClose={() => { setSelected(null); setAction(null) }}
        >
            {action === "renew" && (
              <div className="stack-gap mb-section">
                <div className="renew-box">
                  <p className="muted">Valor da renovação</p>
                  <p className="money">R$ {formatMoney(selected.amount)}</p>
                  <p className="text-xs">{BILLING_LABEL[selected.billing]}</p>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="renew-method">Forma de pagamento</label>
                  <select id="renew-method" className="select" value={actMethod} onChange={e => setActMethod(e.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="card">Cartão</option>
                    <option value="boleto">Boleto</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="renew-note">Observação</label>
                  <input id="renew-note" className="input" value={actNote} onChange={e => setActNote(e.target.value)} placeholder="Ex: comprovante PIX #txid..." />
                </div>
              </div>
            )}

            {action === "cancel" && (
              <div className="alert alert-err mb-section">
                O usuário voltará para o plano <strong>Free</strong> e perderá o acesso aos recursos pagos.
              </div>
            )}

            {action === "reactivate" && (
              <div className="alert-info mb-section">
                A assinatura será reativada com o plano <strong>{PLAN_LABEL[selected.plan] ?? selected.plan}</strong> e uma nova data de vencimento será calculada.
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => { setSelected(null); setAction(null) }} className="btn btn-ghost" disabled={saving}>Cancelar</button>
              <button type="button" onClick={doAction} disabled={saving} className={`btn is-wide ${action === "cancel" ? "btn-danger" : "btn-primary"}`}>
                {saving ? "Aguarde..." : action === "renew" ? "Confirmar renovação" : action === "cancel" ? "Confirmar cancelamento" : "Reativar assinatura"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}
