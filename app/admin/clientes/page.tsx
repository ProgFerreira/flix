"use client"

import { Suspense, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { Modal } from "@/app/components/Modal"
import { Pager } from "@/app/components/Pager"
import { useFilterPage } from "@/app/hooks/useFilterPage"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import {
  Trash2, ShieldOff, ShieldCheck, CreditCard, RefreshCw,
  X, Plus, Receipt, Pencil, Download, Paperclip, MessageCircle,
} from "lucide-react"
import {
  PlanBadge, PLAN_LABEL, METHOD_LABEL, BILLING_LABEL, SUB_STATUS_LABEL, money, fmtDate, fmtDateLong,
} from "@/app/admin/AdminBits"
import { buildAccessWhatsAppUrl, buildContactWhatsAppUrl, formatWhatsAppPhone, normalizeWhatsAppPhone } from "@/lib/whatsapp"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"

type User = {
  id: number
  name: string | null
  email: string
  phone: string | null
  role: string
  plan: string
  status: string
  createdAt: string
  emailVerifiedAt: string | null
  _count: { videos: number; payments: number }
  subscription: { status: string; nextBillingDate: string; billing: string; plan: string } | null
}

type Payment = {
  id: number
  plan: string
  billing?: string
  amount: number | string
  method: string
  note?: string | null
  createdAt: string
  hasReceipt?: boolean
}

type PendingRequest = {
  id: number
  fromPlan: string
  toPlan: string
  billing: string
  amount: string
  note: string | null
  status: string
  createdAt: string
}

type Subscription = {
  id: number
  plan: string
  billing: string
  amount: number | string
  status: string
  startDate: string
  nextBillingDate: string
  cancelledAt: string | null
}

type UserDetail = {
  payments: Payment[]
  subscription: Subscription | null
  pendingRequest: PendingRequest | null
  user: User
}

function ClientesInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const isAdmin = session?.user?.role === "admin"
  const ready = status === "authenticated" && isAdmin
  const myId = Number(session?.user?.id)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const { page, setPage } = useFilterPage(`${debouncedSearch}|${planFilter}|${statusFilter}|${roleFilter}`)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newUserPlan, setNewUserPlan] = useState("free")
  const [newRole, setNewRole] = useState("user")
  const [creating, setCreating] = useState(false)
  const [createdAccess, setCreatedAccess] = useState<{ name: string; email: string; password: string } | null>(null)

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPlan, setEditPlan] = useState("free")
  const [editRole, setEditRole] = useState("user")
  const [editStatus, setEditStatus] = useState("active")
  const [editPhone, setEditPhone] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [drawer, setDrawer] = useState<UserDetail | null>(null)
  const [drawerLoading, setDL] = useState(false)
  const [newPlan, setNewPlan] = useState("premium")
  const [newBilling, setNewBilling] = useState("monthly")
  const [newMethod, setNewMethod] = useState("pix")
  const [newNote, setNewNote] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [reqMethod, setReqMethod] = useState("pix")
  const [reqSaving, setReqSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
  }, [status, isAdmin, router])

  const usersQuery = useQuery({
    queryKey: ["admin", "users", page, debouncedSearch, planFilter, statusFilter, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
      if (planFilter !== "all") params.set("plan", planFilter)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (roleFilter !== "all") params.set("role", roleFilter)
      return apiRequest<{
        items?: User[]
        total?: number
        page?: number
        pageCount?: number
        stats?: { total: number; active: number; blocked: number; free: number; premium: number; pro: number }
      }>(`/api/admin/users?${params}`)
    },
    enabled: ready,
  })

  const users = itemsFromPaginated<User>(usersQuery.data)
  const userMeta = pageMeta(usersQuery.data)
  const stats = usersQuery.data?.stats ?? { total: 0, active: 0, blocked: 0, free: 0, premium: 0, pro: 0 }
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin"] })

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  const openDrawer = async (userId: number) => {
    setDL(true)
    setDrawer(null)
    try {
      const data = await apiRequest<UserDetail>(`/api/admin/users/${userId}`)
      if (!data?.user) {
        setDL(false)
        flash("Não foi possível abrir o cliente", false)
        return
      }
      setDrawer(data)
      setNewPlan(data.user.plan === "free" ? "premium" : data.user.plan === "premium" ? "pro" : "premium")
      setNewBilling("monthly")
      setNewMethod("pix")
      setNewNote("")
      setNewAmount("")
      setReceiptFile(null)
    } catch (err) {
      flash(apiErrorMessage(err, "Não foi possível abrir o cliente"), false)
    }
    setDL(false)
  }

  const userFromQuery = searchParams.get("user")
  useEffect(() => {
    const uid = Number(userFromQuery)
    if (Number.isInteger(uid) && uid > 0) openDrawer(uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFromQuery])

  const openEdit = (u: User) => {
    setEditUser(u)
    setEditName(u.name ?? "")
    setEditEmail(u.email)
    setEditPhone(formatWhatsAppPhone(u.phone) || u.phone || "")
    setEditPlan(u.plan)
    setEditRole(u.role)
    setEditStatus(u.status)
    setEditPassword("")
  }

  const patchUser = async (id: number, data: Record<string, string>) => {
    try {
      await apiRequest(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      invalidate()
      if (drawer?.user.id === id) openDrawer(id)
      flash("Atualizado com sucesso")
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao atualizar"), false)
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setSavingEdit(true)
    const payload: Record<string, string> = {
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      plan: editPlan,
      role: editRole,
      status: editStatus,
    }
    if (editPassword.trim()) payload.password = editPassword
    try {
      await apiRequest(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setEditUser(null)
      flash("Cliente atualizado")
      invalidate()
      if (drawer?.user.id === editUser.id) openDrawer(editUser.id)
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao salvar"), false)
    }
    setSavingEdit(false)
  }

  const deleteUser = async () => {
    if (!pendingDelete) return
    if (pendingDelete.id === myId) { flash("Você não pode excluir a própria conta", false); return }
    setDeleting(true)
    try {
      await apiRequest(`/api/admin/users/${pendingDelete.id}`, { method: "DELETE" })
      if (drawer?.user.id === pendingDelete.id) setDrawer(null)
      setPendingDelete(null)
      invalidate()
      flash("Cliente anonimizado. Pagamentos foram preservados.")
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao excluir"), false)
    }
    setDeleting(false)
  }

  const registerPayment = async () => {
    if (!drawer) return
    setSaving(true)
    const amount = newAmount ? Number(newAmount) : undefined
    try {
      const d = await apiRequest<{ payment?: { id: number } }>("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: drawer.user.id,
          plan: newPlan,
          billing: newBilling,
          method: newMethod,
          note: newNote || undefined,
          amount: Number.isFinite(amount) ? amount : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const paymentId = d?.payment?.id
      if (paymentId && receiptFile) {
        const fd = new FormData()
        fd.append("file", receiptFile)
        try {
          await apiRequest(`/api/admin/receipts/${paymentId}`, { method: "POST", body: fd })
        } catch (err) {
          flash(apiErrorMessage(err, "Pagamento salvo, mas o comprovante não foi anexado"), false)
          await Promise.all([invalidate(), openDrawer(drawer.user.id)])
          setSaving(false)
          return
        }
      }
      flash(newPlan === "free" ? "Cliente rebaixado para Free" : `Pagamento registrado — plano ${PLAN_LABEL[newPlan] ?? newPlan} ativado`)
      setReceiptFile(null)
      await Promise.all([invalidate(), openDrawer(drawer.user.id)])
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao registrar pagamento"), false)
    }
    setSaving(false)
  }

  const uploadReceipt = async (paymentId: number, file?: File) => {
    if (!file || !drawer) return
    const fd = new FormData()
    fd.append("file", file)
    try {
      await apiRequest(`/api/admin/receipts/${paymentId}`, { method: "POST", body: fd })
      flash("Comprovante anexado")
      openDrawer(drawer.user.id)
    } catch (err) {
      flash(apiErrorMessage(err, "Falha ao anexar comprovante"), false)
    }
  }

  const reviewPending = async (action: "approve" | "reject") => {
    if (!drawer?.pendingRequest) return
    setReqSaving(true)
    try {
      await apiRequest(`/api/admin/solicitacoes/${drawer.pendingRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, method: reqMethod }),
      })
      flash(action === "approve" ? "Solicitação aprovada" : "Solicitação recusada")
      await Promise.all([invalidate(), openDrawer(drawer.user.id)])
    } catch (err) {
      flash(apiErrorMessage(err, "Não foi possível analisar"), false)
    }
    setReqSaving(false)
  }

  const resetCreate = () => {
    setShowCreate(false)
    setCreatedAccess(null)
    setNewName("")
    setNewEmail("")
    setNewPassword("")
    setNewPhone("")
    setNewUserPlan("free")
    setNewRole("user")
  }

  const openUserWhatsApp = (u: User) => {
    if (!u.phone) {
      flash("Cadastre o WhatsApp na edição do cliente", false)
      return
    }
    const url = buildContactWhatsAppUrl({
      phone: u.phone,
      name: u.name ?? "",
      email: u.email,
      loginUrl: `${window.location.origin}/login`,
    })
    if (!url) {
      flash("WhatsApp inválido. Atualize o número na edição", false)
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const openAccessWhatsApp = (access: { name: string; email: string; password: string }, phone: string) => {
    const url = buildAccessWhatsAppUrl({
      phone,
      name: access.name,
      email: access.email,
      password: access.password,
      loginUrl: `${window.location.origin}/login`,
    })
    if (!url) {
      flash("Informe um WhatsApp válido com DDD, ex: 11 99999-9999", false)
      return false
    }
    window.open(url, "_blank", "noopener,noreferrer")
    return true
  }

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter
    const sendWhatsApp = submitter instanceof HTMLButtonElement && submitter.value === "whatsapp"
    if (sendWhatsApp && !normalizeWhatsAppPhone(newPhone)) {
      flash("Informe um WhatsApp válido com DDD, ex: 11 99999-9999", false)
      return
    }
    setCreating(true)
    const access = { name: newName.trim(), email: newEmail.trim(), password: newPassword }
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: access.name,
          email: access.email,
          password: access.password,
          phone: newPhone.trim(),
          plan: newUserPlan,
          role: newRole,
        }),
      })
      setCreatedAccess(access)
      flash("Usuário criado")
      invalidate()
      if (sendWhatsApp) openAccessWhatsApp(access, newPhone)
    } catch (err) {
      flash(apiErrorMessage(err, "Erro ao criar usuário"), false)
    }
    setCreating(false)
  }

  if (status === "loading" || (status === "authenticated" && usersQuery.isLoading)) {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  const isSelf = (id: number) => id === myId

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap">
        <div className="page-head is-mid">
          <div>
            <h1 className="page-title">Gestão de clientes</h1>
            <p className="page-sub">Cadastro, plano, acesso e pagamentos de cada usuário</p>
          </div>
          <div className="page-head-actions">
            <button type="button" onClick={() => setShowCreate(true)} className="btn btn-accent">
              <Plus size={13} /> Novo cliente
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const params = new URLSearchParams()
                if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())
                if (planFilter !== "all") params.set("plan", planFilter)
                if (statusFilter !== "all") params.set("status", statusFilter)
                if (roleFilter !== "all") params.set("role", roleFilter)
                window.location.href = `/api/admin/export/clientes?${params}`
              }}
            >
              <Download size={13} /> CSV
            </button>
            <button type="button" onClick={() => invalidate()} className="btn btn-ghost">
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>
        </div>

        {msg && (
          <div className={`alert mb-section ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</div>
        )}

        <div className="stat-grid">
          {[
            { label: "Total", value: stats.total },
            { label: "Ativos", value: stats.active },
            { label: "Bloqueados", value: stats.blocked ?? 0 },
            { label: "Free", value: stats.free },
            { label: "Premium", value: stats.premium },
            { label: "Pro", value: stats.pro },
          ].map((c) => (
            <div key={c.label} className="stat-card">
              <div>
                <p className="stat-value">{c.value}</p>
                <p className="stat-label">{c.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="filter-bar">
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            aria-label="Buscar clientes"
          />
          <select className="select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} aria-label="Filtrar por plano">
            <option value="all">Todos os planos</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
          </select>
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filtrar por papel">
            <option value="all">Todos os papéis</option>
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {["Cliente", "Plano", "Assinatura", "Vídeos", "Status", "Cadastro", "Ações"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sub = u.subscription
                const subCls = !sub || sub.status === "cancelled" ? "" : sub.status === "active" ? "status-ok" : "status-err"
                return (
                  <tr key={u.id}>
                    <td>
                      <p className="cell-title">{u.name ?? "—"}</p>
                      <p className="cell-sub">{u.email}</p>
                      {u.phone && <p className="cell-sub">{formatWhatsAppPhone(u.phone)}</p>}
                      <div className="badge-row">
                        {u.role === "admin" && <span className="badge-admin">ADMIN</span>}
                        {u.emailVerifiedAt
                          ? <span className="badge badge-ok">E-mail ok</span>
                          : <span className="badge badge-warn">E-mail pendente</span>}
                      </div>
                    </td>
                    <td><PlanBadge plan={u.plan} /></td>
                    <td>
                      {sub ? (
                        <>
                          <span className={subCls}>{SUB_STATUS_LABEL[sub.status] ?? sub.status}</span>
                          {sub.status === "active" && (
                            <p className="cell-sub">vence {fmtDate(sub.nextBillingDate)}</p>
                          )}
                        </>
                      ) : <span className="cell-sub">—</span>}
                    </td>
                    <td>{u._count.videos}</td>
                    <td>
                      <span className={u.status === "active" ? "status-ok" : "status-err"}>
                        {u.status === "active" ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="cell-sub">{fmtDate(u.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" onClick={() => openDrawer(u.id)} title="Ficha do cliente" className="btn btn-primary-soft btn-compact">
                          <Receipt size={12} /> Ficha
                        </button>
                        <button
                          type="button"
                          onClick={() => openUserWhatsApp(u)}
                          title={u.phone ? "Enviar WhatsApp" : "Cadastre o WhatsApp na edição"}
                          className={`icon-btn${u.phone ? " is-ok" : ""}`}
                          disabled={!u.phone}
                          aria-label={u.phone ? "Enviar WhatsApp" : "WhatsApp não cadastrado"}
                        >
                          <MessageCircle size={13} />
                        </button>
                        <button type="button" onClick={() => openEdit(u)} title="Editar cliente" className="icon-btn" aria-label="Editar cliente">
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => patchUser(u.id, { status: u.status === "active" ? "blocked" : "active" })}
                          title={u.status === "active" ? "Bloquear" : "Desbloquear"}
                          className={`icon-btn${u.status === "active" ? " is-danger" : " is-ok"}`}
                          disabled={isSelf(u.id)}
                          aria-label={u.status === "active" ? "Bloquear" : "Desbloquear"}
                        >
                          {u.status === "active" ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(u)}
                          title="Excluir usuário"
                          className="icon-btn is-danger"
                          disabled={isSelf(u.id)}
                          aria-label="Excluir usuário"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} className="cell-empty">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={userMeta.page} pageCount={userMeta.pageCount} total={userMeta.total} onPage={setPage} />
      </main>

      {(drawer || drawerLoading) && (
        <>
          <div onClick={() => setDrawer(null)} className="drawer-overlay" />
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-title">
                <h2>{drawer?.user.name ?? "Carregando..."}</h2>
                {drawer && <p className="muted">{drawer.user.email}</p>}
                {drawer?.user.phone && <p className="muted">{formatWhatsAppPhone(drawer.user.phone)}</p>}
              </div>
              {drawer && <PlanBadge plan={drawer.user.plan} />}
              <button type="button" onClick={() => setDrawer(null)} className="icon-btn" aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="drawer-body">
              {drawerLoading && <p className="center-empty">Carregando...</p>}
              {drawer && (
                <>
                  <div className="mini-stats">
                    {[
                      { label: "Plano atual", value: <PlanBadge plan={drawer.user.plan} /> },
                      { label: "Vídeos", value: drawer.user._count.videos },
                      { label: "Pagamentos", value: drawer.payments.length },
                    ].map((c) => (
                      <div key={c.label} className="mini-stat">
                        <p>{c.label}</p>
                        <strong>{c.value}</strong>
                      </div>
                    ))}
                  </div>

                  {drawer.pendingRequest && (
                    <div className="panel">
                      <p className="kicker">Solicitação pendente</p>
                      <p className="cell-title">
                        {PLAN_LABEL[drawer.pendingRequest.fromPlan]} → {PLAN_LABEL[drawer.pendingRequest.toPlan]}
                        {" · "}{BILLING_LABEL[drawer.pendingRequest.billing]}
                        {" · "}{money(drawer.pendingRequest.amount)}
                      </p>
                      {drawer.pendingRequest.note && <p className="muted">{drawer.pendingRequest.note}</p>}
                      {drawer.pendingRequest.toPlan !== "free" && drawer.pendingRequest.toPlan !== drawer.user.plan && (
                        <div className="field">
                          <label className="field-label">Forma (se houver cobrança)</label>
                          <select className="select" value={reqMethod} onChange={(e) => setReqMethod(e.target.value)}>
                            <option value="pix">PIX</option>
                            <option value="card">Cartão</option>
                            <option value="boleto">Boleto</option>
                            <option value="manual">Manual</option>
                          </select>
                        </div>
                      )}
                      <div className="table-actions">
                        <button type="button" className="btn btn-ok-soft btn-compact" disabled={reqSaving} onClick={() => reviewPending("approve")}>Aprovar</button>
                        <button type="button" className="btn btn-danger-soft btn-compact" disabled={reqSaving} onClick={() => reviewPending("reject")}>Recusar</button>
                      </div>
                    </div>
                  )}

                  {drawer.subscription && (
                    <div className="panel">
                      <p className="kicker">Assinatura</p>
                      <p className="cell-title">
                        {PLAN_LABEL[drawer.subscription.plan]} · {BILLING_LABEL[drawer.subscription.billing]} · {money(drawer.subscription.amount)}
                      </p>
                      <p className="muted">
                        {SUB_STATUS_LABEL[drawer.subscription.status] ?? drawer.subscription.status}
                        {" · "}próximo vencimento {fmtDate(drawer.subscription.nextBillingDate)}
                      </p>
                    </div>
                  )}

                  <div className="panel">
                    <div className="panel-title"><Plus size={14} /> Registrar pagamento</div>
                    <div className="stack">
                      <div className="field">
                        <label className="field-label">Novo plano</label>
                        <div className="choice-row">
                          {["free", "premium", "pro"].map((p) => (
                            <button type="button" key={p} onClick={() => setNewPlan(p)} className={`choice${newPlan === p ? " is-on" : ""}`}>
                              {PLAN_LABEL[p]}
                              {p === "premium" && <small>R$ 10 / R$ 96/ano</small>}
                              {p === "pro" && <small>R$ 17,90 / R$ 172/ano</small>}
                              {p === "free" && <small>Grátis</small>}
                            </button>
                          ))}
                        </div>
                        {newPlan !== "free" && (
                          <div className="field">
                            <label className="field-label">Tipo de cobrança</label>
                            <div className="choice-row">
                              {[["monthly", "Mensal"], ["annual", "Anual (20% off)"]].map(([v, l]) => (
                                <button type="button" key={v} onClick={() => { setNewBilling(v); setNewAmount("") }} className={`choice${newBilling === v ? " is-accent" : ""}`}>
                                  {l}
                                  {v === "monthly" && newPlan === "premium" && <small>R$ 10,00</small>}
                                  {v === "monthly" && newPlan === "pro" && <small>R$ 17,90</small>}
                                  {v === "annual" && newPlan === "premium" && <small>R$ 96,00</small>}
                                  {v === "annual" && newPlan === "pro" && <small>R$ 171,84</small>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {newPlan !== "free" && (
                        <>
                          <div className="grid-2">
                            <div className="field">
                              <label className="field-label">Valor (R$)</label>
                              <input
                                className="input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                                placeholder={newPlan === "premium" ? (newBilling === "annual" ? "96.00" : "10.00") : (newBilling === "annual" ? "171.84" : "17.90")}
                              />
                            </div>
                            <div className="field">
                              <label className="field-label">Forma de pagamento</label>
                              <select className="select" value={newMethod} onChange={(e) => setNewMethod(e.target.value)}>
                                <option value="pix">PIX</option>
                                <option value="card">Cartão</option>
                                <option value="boleto">Boleto</option>
                                <option value="manual">Manual</option>
                              </select>
                            </div>
                          </div>
                          <div className="field">
                            <label className="field-label">Observação</label>
                            <input className="input" value={newNote} onChange={(e) => setNewNote(e.target.value)} maxLength={200} placeholder="Ex: PIX comprovante #123..." />
                          </div>
                          <div className="field">
                            <label className="field-label">Comprovante (JPEG, PNG, WebP ou PDF)</label>
                            <input
                              className="file-input"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                            />
                          </div>
                        </>
                      )}
                      <button type="button" onClick={registerPayment} disabled={saving} className="btn btn-primary btn-block">
                        <CreditCard size={13} /> {saving ? "Registrando..." : newPlan === "free" ? "Rebaixar para Free" : "Confirmar pagamento"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="kicker">Histórico ({drawer.payments.length})</p>
                    {drawer.payments.length === 0 && <div className="center-empty">Nenhum pagamento registrado</div>}
                    <div className="stack">
                      {drawer.payments.map((p) => (
                        <div key={p.id} className="pay-item">
                          <div className="pay-item-head">
                            <div className="pay-item-meta">
                              <PlanBadge plan={p.plan} />
                              <span className="money">R$ {formatMoney(p.amount)}</span>
                              <span className="role-tag is-view">{METHOD_LABEL[p.method] ?? p.method}</span>
                            </div>
                            <span className="text-xs">{fmtDateLong(p.createdAt)}</span>
                          </div>
                          {p.note && <p className="muted-2">{p.note}</p>}
                          <div className="table-actions">
                            {p.hasReceipt ? (
                              <a className="btn btn-ghost btn-compact" href={`/api/admin/receipts/${p.id}`} target="_blank" rel="noreferrer">
                                <Paperclip size={12} /> Ver comprovante
                              </a>
                            ) : (
                              <label className="btn btn-ghost btn-compact">
                                <Paperclip size={12} /> Anexar
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept="image/jpeg,image/png,image/webp,application/pdf"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    e.target.value = ""
                                    if (f) uploadReceipt(p.id, f)
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {drawer.payments.length > 0 && (
                      <div className="pay-total">
                        <span>Total recebido deste cliente</span>
                        <strong>{money(drawer.payments.reduce((s, p) => s + Number(p.amount), 0))}</strong>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <Modal
          open
          title={createdAccess ? "Cliente criado" : "Novo cliente"}
          description={createdAccess ? "Envie os dados de acesso pelo WhatsApp." : "Crie uma conta e, se quiser, envie o acesso pelo WhatsApp."}
          busy={creating}
          onClose={resetCreate}
        >
            {createdAccess ? (
              <div className="auth-form">
                <div className="alert alert-ok" role="status">Conta criada. Envie os dados de acesso pelo WhatsApp.</div>
                <div className="panel">
                  <p className="kicker">Dados de acesso</p>
                  <p className="cell-title">{createdAccess.name}</p>
                  <p className="cell-sub">E-mail: {createdAccess.email}</p>
                  <p className="cell-sub">Senha: {createdAccess.password}</p>
                  <p className="cell-sub">Login: {`${window.location.origin}/login`}</p>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="created-whatsapp">WhatsApp</label>
                  <input
                    id="created-whatsapp"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="11 99999-9999"
                    maxLength={24}
                  />
                  <p className="muted-2">Com DDD. O WhatsApp abre com e-mail, senha e o link de login.</p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ok-soft is-wide"
                    onClick={() => openAccessWhatsApp(createdAccess, newPhone)}
                  >
                    <MessageCircle size={13} /> Enviar no WhatsApp
                  </button>
                  <button type="button" className="btn btn-primary" onClick={resetCreate}>
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={createUser} className="auth-form">
                <div className="field">
                  <label className="field-label" htmlFor="new-client-name">Nome</label>
                  <input id="new-client-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={80} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="new-client-email">E-mail</label>
                  <input id="new-client-email" className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="new-client-password">Senha</label>
                  <input id="new-client-password" className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} maxLength={72} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="new-client-phone">WhatsApp</label>
                  <input
                    id="new-client-phone"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="11 99999-9999"
                    maxLength={24}
                  />
                  <p className="muted-2">Opcional. Necessário para enviar os dados de acesso.</p>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="new-client-plan">Plano</label>
                  <select id="new-client-plan" className="select" value={newUserPlan} onChange={(e) => setNewUserPlan(e.target.value)}>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="new-client-role">Papel</label>
                  <select id="new-client-role" className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                    <option value="user">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="stack">
                  <button type="submit" name="intent" value="create" className="btn btn-primary btn-block" disabled={creating}>
                    {creating ? "Criando..." : "Criar cliente"}
                  </button>
                  <button type="submit" name="intent" value="whatsapp" className="btn btn-ok-soft btn-block" disabled={creating}>
                    <MessageCircle size={13} /> {creating ? "Criando..." : "Criar e enviar no WhatsApp"}
                  </button>
                </div>
              </form>
            )}
        </Modal>
      )}

      {editUser && (
        <Modal open title="Editar cliente" description="Atualize dados, plano e papel desta conta." busy={savingEdit} onClose={() => setEditUser(null)}>
            <form onSubmit={saveEdit} className="auth-form">
              <div className="field">
                <label className="field-label" htmlFor="edit-client-name">Nome</label>
                <input id="edit-client-name" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={80} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-client-email">E-mail</label>
                <input id="edit-client-email" className="input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-client-phone">WhatsApp</label>
                <input
                  id="edit-client-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="11 99999-9999"
                  maxLength={24}
                />
                <p className="muted-2">Com DDD. Usado para enviar os dados de acesso.</p>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="edit-client-plan">Plano</label>
                  <select id="edit-client-plan" className="select" value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="edit-client-status">Status</label>
                  <select id="edit-client-status" className="select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} disabled={isSelf(editUser.id)}>
                    <option value="active">Ativo</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-client-role">Papel</label>
                <select id="edit-client-role" className="select" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={isSelf(editUser.id)}>
                  <option value="user">Usuário</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="edit-client-password">Nova senha (opcional)</label>
                <input id="edit-client-password" className="input" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} minLength={8} maxLength={72} placeholder="Deixe em branco para manter" />
              </div>
              <p className="muted-2">Alterar o plano aqui libera o acesso sem registrar cobrança. Para receber, use a ficha do cliente.</p>
              <button type="submit" className="btn btn-primary btn-block" disabled={savingEdit}>
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir cliente?"
        descricao={`A conta de "${pendingDelete?.name ?? pendingDelete?.email ?? ""}" será anonimizada. Biblioteca e uploads saem; o histórico de pagamentos permanece.`}
        confirmarLabel="Anonimizar"
        perigo
        carregando={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null) }}
        onConfirm={deleteUser}
      />
    </div>
  )
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>}>
      <ClientesInner />
    </Suspense>
  )
}

