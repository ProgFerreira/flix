"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { Pager } from "@/app/components/Pager"
import { useFilterPage } from "@/app/hooks/useFilterPage"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { RefreshCw } from "lucide-react"
import { fmtDateLong } from "@/app/admin/AdminBits"

type AuditRow = {
  id: number
  action: string
  targetType: string
  targetId: number | null
  meta: Record<string, unknown> | null
  createdAt: string
  admin: { id: number; name: string | null; email: string } | null
}

const ACTION_LABEL: Record<string, string> = {
  "user.create": "Criou cliente",
  "user.update": "Atualizou cliente",
  "user.delete": "Excluiu cliente",
  "payment.create": "Registrou pagamento",
  "payment.receipt": "Anexou comprovante",
  "plan_change.approve": "Aprovou solicitação",
  "plan_change.reject": "Recusou solicitação",
  "subscription.renew": "Renovou assinatura",
  "subscription.cancel": "Cancelou assinatura",
  "subscription.reactivate": "Reativou assinatura",
  "billing.sync": "Sincronizou vencimentos",
  "video.upload": "Enviou vídeo",
  "video.update": "Atualizou vídeo",
  "video.delete": "Excluiu vídeo",
  "course.create": "Criou curso",
  "course.update": "Atualizou curso",
  "course.delete": "Excluiu curso",
  "export.clientes": "Exportou clientes",
  "export.pagamentos": "Exportou pagamentos",
  "auth.login": "Login",
  "auth.login_fail": "Falha de login",
}

export default function AuditoriaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === "admin"
  const ready = status === "authenticated" && isAdmin

  const [action, setAction] = useState("all")
  const { page, setPage } = useFilterPage(action)

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const query = useQuery({
    queryKey: ["admin", "audit", page, action],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (action !== "all") params.set("action", action)
      const res = await fetch(`/api/admin/audit?${params}`)
      if (!res.ok) throw new Error("Falha ao carregar auditoria")
      return res.json()
    },
    enabled: ready,
  })

  const rows = itemsFromPaginated<AuditRow>(query.data)
  const meta = pageMeta(query.data)

  if (status === "loading" || (status === "authenticated" && query.isLoading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Auditoria</h1>
            <p className="page-sub">Registro das ações da gestão em clientes, pagamentos e planos</p>
          </div>
          <button type="button" onClick={() => query.refetch()} className="btn btn-ghost">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        <div className="filter-bar">
          <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filtrar por ação">
            <option value="all">Todas as ações</option>
            {Object.entries(ACTION_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {["Quando", "Quem", "Ação", "Alvo"].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="cell-sub">{fmtDateLong(row.createdAt)}</td>
                  <td>
                    <p className="cell-title">{row.admin?.name ?? "—"}</p>
                    <p className="cell-sub">{row.admin?.email ?? "conta removida"}</p>
                  </td>
                  <td className="cell-title">{ACTION_LABEL[row.action] ?? row.action}</td>
                  <td className="cell-sub">
                    {row.targetType}{row.targetId ? ` #${row.targetId}` : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="cell-empty">Nenhuma ação registrada ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={meta.page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
      </main>
    </div>
  )
}
