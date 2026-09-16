"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { OperationsPanel } from "./OperationsPanel"
import { AppHeader } from "@/app/components/AppHeader"
import { itemsFromPaginated } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import {
  Users, CreditCard, Layers, Film, ShieldCheck, DollarSign, AlertTriangle, ArrowRight, ClipboardList, ScrollText, BookOpen,
} from "lucide-react"
import { PlanBadge, fmtDate } from "@/app/admin/AdminBits"

type UserRow = {
  id: number
  name: string | null
  email: string
  role: string
  plan: string
  status: string
  createdAt: string
}

type PaymentRow = {
  id: number
  plan: string
  amount: number | string
  method: string
  createdAt: string
  user?: { id: number; name: string | null; email: string }
}

type SubRow = {
  id: number
  status: string
  nextBillingDate: string
  user: { name: string | null; email: string }
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === "admin"
  const ready = status === "authenticated" && isAdmin

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const dashQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const [uRes, pRes, sRes, rRes] = await Promise.all([
        fetch("/api/admin/users?page=1&limit=6"),
        fetch("/api/admin/payments?page=1&limit=6"),
        fetch("/api/admin/assinaturas"),
        fetch("/api/admin/solicitacoes?status=pending&page=1&limit=6"),
      ])
      const u = await uRes.json()
      const p = await pRes.json()
      const s = await sRes.json()
      const r = await rRes.json()
      const userStats = {
        total: u?.stats?.total ?? 0,
        active: u?.stats?.active ?? 0,
        blocked: u?.stats?.blocked ?? 0,
        free: u?.stats?.free ?? 0,
        premium: u?.stats?.premium ?? 0,
        pro: u?.stats?.pro ?? 0,
      }
      const payStats = {
        count: p?.stats?.count ?? 0,
        revenue: p?.stats?.revenue ?? 0,
      }
      const overdue: SubRow[] = Array.isArray(s)
        ? s.filter((x: SubRow) => x.status === "overdue" || (x.status === "active" && new Date(x.nextBillingDate) < new Date()))
        : []
      return {
        users: itemsFromPaginated<UserRow>(u),
        payments: itemsFromPaginated<PaymentRow>(p),
        userStats,
        payStats,
        overdue,
        pendingRequestCount: r?.stats?.pending ?? 0,
      }
    },
    enabled: ready,
  })

  const users = dashQuery.data?.users ?? []
  const payments = dashQuery.data?.payments ?? []
  const userStats = dashQuery.data?.userStats ?? { total: 0, active: 0, blocked: 0, free: 0, premium: 0, pro: 0 }
  const payStats = dashQuery.data?.payStats ?? { count: 0, revenue: 0 }
  const overdue = dashQuery.data?.overdue ?? []
  const pendingRequestCount = dashQuery.data?.pendingRequestCount ?? 0

  if (status === "loading" || (status === "authenticated" && dashQuery.isLoading)) {
    return (
      <div className="page">
        <AppHeader />
        <div className="loading-center">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Painel administrativo</h1>
            <p className="page-sub">Gestão de clientes, pagamentos, assinaturas e catálogo</p>
          </div>
        </div>

        <div className="stat-grid">
          {[
            { label: "Clientes", value: userStats.total, color: "#1E40AF", icon: <Users size={17} /> },
            { label: "Ativos", value: userStats.active, color: "#16A34A", icon: <ShieldCheck size={17} /> },
            { label: "Premium + Pro", value: userStats.premium + userStats.pro, color: "#7C3AED", icon: <CreditCard size={17} /> },
            { label: "Receita", value: `R$ ${formatMoney(payStats.revenue)}`, color: "#F97316", icon: <DollarSign size={17} /> },
          ].map((c) => (
            <div key={c.label} className="stat-card">
              <div className="stat-icon" style={{ ["--stat-color" as string]: c.color }}>{c.icon}</div>
              <div>
                <p className="stat-value">{c.value}</p>
                <p className="stat-label">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        {pendingRequestCount > 0 && (
          <div className="alert-banner banner-warn mb-section">
            <ClipboardList size={16} />
            <p>{pendingRequestCount} {pendingRequestCount === 1 ? "solicitação" : "solicitações"} de troca de plano aguardando aprovação</p>
            <Link href="/admin/solicitacoes" className="btn btn-ghost btn-compact">Analisar</Link>
          </div>
        )}

        {overdue.length > 0 && (
          <div className="alert-banner banner-warn mb-section">
            <AlertTriangle size={16} />
            <p>{overdue.length} assinatura{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""} ou em atraso</p>
            <Link href="/admin/assinaturas" className="btn btn-ghost btn-compact">Ver assinaturas</Link>
          </div>
        )}

        <div className="dash-grid">
          {[
            { href: "/admin/clientes", title: "Clientes", desc: "Cadastro, plano, bloqueio e histórico de cada usuário", icon: <Users size={18} /> },
            { href: "/admin/pagamentos", title: "Pagamentos", desc: "Todos os recebimentos, filtros e receita", icon: <DollarSign size={18} /> },
            { href: "/admin/assinaturas", title: "Assinaturas", desc: "Vencimentos, renovação e cancelamento", icon: <Layers size={18} /> },
            { href: "/admin/solicitacoes", title: "Solicitações", desc: "Pedidos de troca de plano para aprovar ou recusar", icon: <ClipboardList size={18} /> },
            { href: "/admin/auditoria", title: "Auditoria", desc: "Quem bloqueou, cobrou ou mudou plano", icon: <ScrollText size={18} /> },
            { href: "/admin/videos", title: "Vídeos autorais", desc: "Upload e plano mínimo de cada vídeo do catálogo", icon: <Film size={18} /> },
            { href: "/admin/cursos", title: "Cursos", desc: "Módulos, ordem das aulas e publicação da trilha", icon: <BookOpen size={18} /> },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="card dash-link">
              <span className="dash-link-icon">{l.icon}</span>
              <h2>{l.title}</h2>
              <p>{l.desc}</p>
              <span className="dash-link-go"><ArrowRight size={14} /> Abrir</span>
            </Link>
          ))}
        </div>

        <div className="dash-split">
          <section>
            <div className="between mb-section">
              <h2 className="kicker kicker-inline">Últimos clientes</h2>
              <Link href="/admin/clientes" className="btn btn-ghost btn-compact">Ver todos</Link>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Cliente", "Plano", "Status", "Cadastro"].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <p className="cell-title">{u.name ?? "—"}</p>
                        <p className="cell-sub">{u.email}</p>
                      </td>
                      <td><PlanBadge plan={u.plan} /></td>
                      <td>
                        <span className={u.status === "active" ? "status-ok" : "status-err"}>
                          {u.status === "active" ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="cell-sub">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="cell-empty">Nenhum cliente ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="between mb-section">
              <h2 className="kicker kicker-inline">Últimos pagamentos</h2>
              <Link href="/admin/pagamentos" className="btn btn-ghost btn-compact">Ver todos</Link>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Cliente", "Plano", "Valor", "Data"].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <p className="cell-title">{p.user?.name ?? "—"}</p>
                        <p className="cell-sub">{p.user?.email}</p>
                      </td>
                      <td><PlanBadge plan={p.plan} /></td>
                      <td className="money">R$ {formatMoney(p.amount)}</td>
                      <td className="cell-sub">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={4} className="cell-empty">Nenhum pagamento ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      <OperationsPanel />
      </main>
    </div>
  )
}
