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
import { CheckCircle2, XCircle, Clock, RefreshCw, ClipboardList } from "lucide-react"
import { PlanBadge, PLAN_LABEL, BILLING_LABEL, fmtDateLong } from "@/app/admin/AdminBits"

type RequestRow = {
  hasReceipt: boolean
  id: number
  userId: number
  fromPlan: string
  toPlan: string
  billing: string
  amount: string
  note: string | null
  status: string
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  user: { id: number; name: string | null; email: string; plan: string; status: string }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
}

const PLAN_RANK: Record<string, number> = { free: 0, premium: 1, pro: 2 }

function isUpgrade(fromPlan: string, toPlan: string) {
  return (PLAN_RANK[toPlan] ?? 0) > (PLAN_RANK[fromPlan] ?? 0)
}

export default function SolicitacoesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState("pending")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const { page, setPage } = useFilterPage(`${debouncedSearch}|${filter}`)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [selected, setSelected] = useState<RequestRow | null>(null)
  const [action, setAction] = useState<"approve" | "reject" | null>(null)
  const [actMethod, setActMethod] = useState("pix")
  const [actNote, setActNote] = useState("")
  const [saving, setSaving] = useState(false)

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

  const query = useQuery({
    queryKey: ["admin", "solicitacoes", page, debouncedSearch, filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      if (filter !== "all") params.set("status", filter)
      const res = await fetch(`/api/admin/solicitacoes?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar solicitações")
      return res.json()
    },
    enabled: ready,
  })

  const rows = itemsFromPaginated<RequestRow>(query.data)
  const meta = pageMeta(query.data)
  const pendingCount = query.data?.stats?.pending ?? 0
  const loading = query.isLoading

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  const doAction = async () => {
    if (!selected || !action) return
    setSaving(true)
    try {
    const res = await fetch(`/api/admin/solicitacoes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        method: action === "approve" ? actMethod : undefined,
        note: actNote || undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      flash(data?.error ?? "Erro ao executar ação", false)
      return
    }
    flash(action === "approve" ? "Plano ativado" : "Solicitação recusada")
    setSelected(null)
    setAction(null)
    setActNote("")
    queryClient.invalidateQueries({ queryKey: ["admin"] })
    } catch { flash("Falha de conexão. Tente novamente.", false) }
    finally { setSaving(false) }
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
            <h1 className="page-title">Solicitações de plano</h1>
            <p className="page-sub">Pedidos de troca enviados pelos clientes. Aprove após conferir o pagamento.</p>
          </div>
          <div className="page-head-actions">
            <button type="button" onClick={() => router.push("/admin")} className="btn btn-ghost">← Admin</button>
            <button type="button" onClick={() => query.refetch()} className="btn btn-ghost"><RefreshCw size={13} /> Atualizar</button>
          </div>
        </div>

        {msg && (
          <div className={`alert mb-section ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>
        )}

        {pendingCount > 0 && filter !== "pending" && (
          <div className="alert-banner banner-warn">
            <ClipboardList size={16} />
            <p>{pendingCount} {pendingCount === 1 ? "solicitação" : "solicitações"} aguardando análise</p>
            <button type="button" className="btn btn-ghost btn-compact" onClick={() => setFilter("pending")}>Ver pendentes</button>
          </div>
        )}

        <div className="filter-bar">
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." aria-label="Buscar solicitações" />
          {["pending", "approved", "rejected", "cancelled", "all"].map(f => {
            const labels: Record<string, string> = {
              pending: "Pendentes",
              approved: "Aprovadas",
              rejected: "Recusadas",
              cancelled: "Canceladas",
              all: "Todas",
            }
            return (
              <button type="button" key={f} onClick={() => setFilter(f)} className={`chip is-blue${filter === f ? " is-active" : ""}`}>
                {labels[f]}
                {f === "pending" && <span className="filter-count is-err">({pendingCount})</span>}
              </button>
            )
          })}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {["Cliente", "De → Para", "Cobrança", "Valor", "Pedido em", "Status", "Ações"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.status === "pending" ? "is-warn" : undefined}>
                  <td>
                    <p className="cell-title">{row.user.name ?? "—"}</p>
                    <p className="cell-sub">{row.user.email}</p>
                    {row.hasReceipt && <a className="link" href={`/api/plano/comprovante?id=${row.id}`}>Baixar comprovante</a>}
                  </td>
                  <td>
                    <div className="chip-row">
                      <PlanBadge plan={row.fromPlan} />
                      <span className="muted">→</span>
                      <PlanBadge plan={row.toPlan} />
                    </div>
                  </td>
                  <td>{row.toPlan === "free" ? "—" : BILLING_LABEL[row.billing]}</td>
                  <td className="cell-title">{row.toPlan === "free" ? "—" : `R$ ${formatMoney(row.amount)}`}</td>
                  <td className="cell-sub">{fmtDateLong(row.createdAt)}</td>
                  <td>
                    <span className={`badge ${row.status === "pending" ? "badge-warn" : row.status === "approved" ? "badge-ok" : "badge-free"}`}>
                      {row.status === "pending" ? <Clock size={12} /> : row.status === "approved" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {" "}{STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td>
                    {row.status === "pending" ? (
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ok-soft btn-compact"
                          onClick={() => { setSelected(row); setAction("approve"); setActMethod("pix"); setActNote("") }}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-soft btn-compact"
                          onClick={() => { setSelected(row); setAction("reject"); setActNote("") }}
                        >
                          Recusar
                        </button>
                      </div>
                    ) : (
                      <span className="muted-2">{row.reviewNote || "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="cell-empty">
                    Nenhuma solicitação nesta lista
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>

      {selected && action && (
        <Modal open title={action === "approve" ? "Aprovar troca de plano" : "Recusar solicitação"} description={`${selected.user.name ?? selected.user.email} — ${PLAN_LABEL[selected.fromPlan]} → ${PLAN_LABEL[selected.toPlan]}`} busy={saving} onClose={() => { setSelected(null); setAction(null) }}>


            {action === "approve" && (
              <div className="stack-gap mb-section">
                {isUpgrade(selected.fromPlan, selected.toPlan) && selected.toPlan !== "free" ? (
                  <>
                    <div className="alert-info">
                      Confirme o pagamento antes de ativar. Isso registra o recebimento e muda o plano do cliente.
                    </div>
                    <div className="renew-box">
                      <p className="muted">Valor esperado</p>
                      <p className="money">R$ {formatMoney(selected.amount)}</p>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="solicitacao-method">Forma de pagamento</label>
                      <select id="solicitacao-method" className="select" value={actMethod} onChange={e => setActMethod(e.target.value)}>
                        <option value="pix">PIX</option>
                        <option value="card">Cartão</option>
                        <option value="boleto">Boleto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="alert-info">
                    {selected.toPlan === "free"
                      ? "O cliente volta ao plano Free e a assinatura paga é cancelada."
                      : "Troca sem novo pagamento. O plano do cliente será atualizado."}
                  </div>
                )}
                {selected.note && <p className="muted">Observação do cliente: {selected.note}</p>}
                <div className="field">
                  <label className="field-label" htmlFor="solicitacao-note">Observação interna</label>
                  <input id="solicitacao-note" className="input" value={actNote} onChange={e => setActNote(e.target.value)} maxLength={200} placeholder="Ex: PIX conferido #txid..." />
                </div>
              </div>
            )}

            {action === "reject" && (
              <div className="stack-gap mb-section">
                <div className="alert alert-err">O plano atual do cliente não muda.</div>
                <div className="field">
                  <label className="field-label" htmlFor="solicitacao-reason">Motivo (opcional)</label>
                  <input id="solicitacao-reason" className="input" value={actNote} onChange={e => setActNote(e.target.value)} maxLength={200} placeholder="Ex: comprovante não localizado" />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" disabled={saving} onClick={() => { setSelected(null); setAction(null) }} className="btn btn-ghost">Cancelar</button>
              <button
                type="button"
                onClick={doAction}
                disabled={saving}
                className={`btn is-wide ${action === "reject" ? "btn-danger" : "btn-primary"}`}
              >
                {saving ? "Aguarde..." : action === "approve" ? "Confirmar aprovação" : "Confirmar recusa"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}
