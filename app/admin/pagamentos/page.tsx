"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { Pager } from "@/app/components/Pager"
import { useFilterPage } from "@/app/hooks/useFilterPage"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import { RefreshCw, DollarSign, Download, Paperclip } from "lucide-react"
import { PlanBadge, METHOD_LABEL, BILLING_LABEL, fmtDate } from "@/app/admin/AdminBits"

type Payment = {
  id: number
  plan: string
  billing: string
  amount: number | string
  method: string
  note?: string | null
  createdAt: string
  hasReceipt?: boolean
  user?: { id: number; name: string | null; email: string }
}

export default function AdminPagamentosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === "admin"
  const ready = status === "authenticated" && isAdmin

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const { page, setPage } = useFilterPage(`${debouncedSearch}|${planFilter}|${methodFilter}`)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments", page, debouncedSearch, planFilter, methodFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      if (planFilter !== "all") params.set("plan", planFilter)
      if (methodFilter !== "all") params.set("method", methodFilter)
      const res = await fetch(`/api/admin/payments?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar pagamentos")
      return res.json()
    },
    enabled: ready,
  })

  const payments = itemsFromPaginated<Payment>(paymentsQuery.data)
  const meta = pageMeta(paymentsQuery.data)
  const stats = paymentsQuery.data?.stats ?? { count: 0, revenue: 0 }
  const filtered = Boolean(debouncedSearch || planFilter !== "all" || methodFilter !== "all")

  if (status === "loading" || (status === "authenticated" && paymentsQuery.isLoading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Pagamentos</h1>
            <p className="page-sub">Histórico de recebimentos e receita por cliente</p>
          </div>
          <div className="page-head-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const params = new URLSearchParams()
                if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
                if (planFilter !== "all") params.set("plan", planFilter)
                if (methodFilter !== "all") params.set("method", methodFilter)
                window.location.href = `/api/admin/export/pagamentos?${params}`
              }}
            >
              <Download size={13} /> CSV
            </button>
            <button type="button" onClick={() => paymentsQuery.refetch()} className="btn btn-ghost">
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ ["--stat-color" as string]: "#1E40AF" }}>
              <DollarSign size={17} />
            </div>
            <div>
              <p className="stat-value">{stats.count}</p>
              <p className="stat-label">Pagamentos</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ ["--stat-color" as string]: "#16A34A" }}>
              <DollarSign size={17} />
            </div>
            <div>
              <p className="stat-value">R$ {formatMoney(stats.revenue)}</p>
              <p className="stat-label">{filtered ? "Receita filtrada" : "Receita total"}</p>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente (nome ou e-mail)..."
            aria-label="Buscar pagamentos"
          />
          <select className="select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} aria-label="Filtrar por plano">
            <option value="all">Todos os planos</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
          <select className="select" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} aria-label="Filtrar por método">
            <option value="all">Todos os métodos</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="boleto">Boleto</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {["Cliente", "Plano", "Cobrança", "Valor", "Método", "Observação", "Comprovante", "Data"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.user?.id ? (
                      <Link href={`/admin/clientes?user=${p.user.id}`} className="cell-link">
                        <p className="cell-title">{p.user.name ?? "—"}</p>
                        <p className="cell-sub">{p.user.email}</p>
                      </Link>
                    ) : (
                      <>
                        <p className="cell-title">{p.user?.name ?? "—"}</p>
                        <p className="cell-sub">{p.user?.email}</p>
                      </>
                    )}
                  </td>
                  <td><PlanBadge plan={p.plan} /></td>
                  <td>{BILLING_LABEL[p.billing] ?? p.billing ?? "—"}</td>
                  <td className="money">R$ {formatMoney(p.amount)}</td>
                  <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                  <td className="cell-note">{p.note ?? "—"}</td>
                  <td>
                    {p.hasReceipt ? (
                      <a className="btn btn-ghost btn-compact" href={`/api/admin/receipts/${p.id}`} target="_blank" rel="noreferrer">
                        <Paperclip size={12} /> Ver
                      </a>
                    ) : <span className="cell-sub">—</span>}
                  </td>
                  <td className="cell-sub">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={8} className="cell-empty">Nenhum pagamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>
    </div>
  )
}
