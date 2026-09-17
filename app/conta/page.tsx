"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { signOutToLogin } from "@/lib/sign-out"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Receipt,
  Star,
  UserRound,
  Zap,
} from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"
import { ConfirmDialog } from "@/app/components/ConfirmDialog"
import { useRequireAuth } from "@/app/components/useRequireAuth"
import {
  BILLING_LABEL,
  METHOD_LABEL,
  PLAN_LABEL,
  SUB_STATUS_LABEL,
  fmtDate,
  fmtDateLong,
  money,
} from "@/app/admin/AdminBits"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"

type PendingRequest = {
  id: number
  toPlan: string
  billing: string
  amount: string
  status: string
}

type Subscription = {
  plan: string
  billing: string
  amount: string
  status: string
  startDate: string
  nextBillingDate: string
  cancelledAt: string | null
}

type Payment = {
  id: number
  plan: string
  billing: string
  amount: string
  method: string
  createdAt: string
}

type Account = {
  email: string
  name: string | null
  plan: string
  role: string
  createdAt: string
  emailVerifiedAt: string | null
  videoCount?: number
  subscription?: Subscription | null
  pendingRequest?: PendingRequest | null
  payments?: Payment[]
}

const PLAN_LIMIT: Record<string, number | null> = { free: 20, premium: 100, pro: null }
const PLAN_HINT: Record<string, string> = {
  free: "Até 20 vídeos na biblioteca",
  premium: "Até 100 vídeos na biblioteca",
  pro: "Vídeos ilimitados",
}

function planIcon(plan: string) {
  if (plan === "pro") return <Crown size={18} />
  if (plan === "premium") return <Zap size={18} />
  return <Star size={18} />
}

function initials(name?: string | null, email?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return (email ?? "?").slice(0, 2).toUpperCase()
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function dueClass(status: string, nextBillingDate: string) {
  if (status === "overdue" || status === "expired") return "is-err"
  if (status === "active" && daysUntil(nextBillingDate) <= 7) return "is-warn"
  return ""
}

function statusBadgeClass(status: string) {
  if (status === "overdue" || status === "cancelled" || status === "expired") return status
  return "active"
}

export default function ContaPage() {
  const status = useRequireAuth()
  const { data: session, update } = useSession()
  const queryClient = useQueryClient()

  const [nameOverride, setNameOverride] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [passMsg, setPassMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [verifyMsg, setVerifyMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pendingMsg, setPendingMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [resending, setResending] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: () => apiRequest<Account>("/api/account"),
    enabled: status === "authenticated",
  })

  const account = accountQuery.data?.email ? accountQuery.data : null
  const name = nameOverride ?? account?.name ?? session?.user?.name ?? ""

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingName(true)
    setNameMsg(null)
    try {
      await apiRequest("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const trimmed = name.trim()
      await update({ name: trimmed })
      setNameOverride(trimmed)
      await queryClient.invalidateQueries({ queryKey: ["account"] })
      setNameMsg({ text: "Nome atualizado", ok: true })
    } catch (err) {
      setNameMsg({ text: apiErrorMessage(err, "Não foi possível salvar"), ok: false })
    }
    setSavingName(false)
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassMsg(null)
    if (newPassword !== confirm) {
      setPassMsg({ text: "As senhas não coincidem", ok: false })
      return
    }
    setSavingPass(true)
    try {
      await apiRequest("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirm("")
      setPassMsg({ text: "Senha alterada", ok: true })
    } catch (err) {
      setPassMsg({ text: apiErrorMessage(err, "Não foi possível alterar a senha"), ok: false })
    }
    setSavingPass(false)
  }

  const resendVerification = async () => {
    setResending(true)
    setVerifyMsg(null)
    try {
      await apiRequest("/api/auth/resend-verification", { method: "POST" })
      setVerifyMsg({ text: "Enviamos um novo e-mail de confirmação", ok: true })
    } catch (err) {
      setVerifyMsg({ text: apiErrorMessage(err, "Não foi possível reenviar"), ok: false })
    }
    setResending(false)
  }

  const cancelPending = async () => {
    setCancelling(true)
    setPendingMsg(null)
    try {
      await apiRequest("/api/plano", { method: "DELETE" })
      setPendingMsg({ text: "Solicitação cancelada", ok: true })
      await queryClient.invalidateQueries({ queryKey: ["account"] })
      await queryClient.invalidateQueries({ queryKey: ["plano"] })
    } catch (err) {
      setPendingMsg({ text: apiErrorMessage(err, "Não foi possível cancelar"), ok: false })
    }
    setCancelling(false)
  }

  if (status === "loading" || status === "unauthenticated") {
    return <div className="page"><AppHeader /><div className="loading-center">Carregando...</div></div>
  }

  const displayName = name.trim() || session?.user?.name || "Sua conta"
  const email = account?.email ?? session?.user?.email ?? ""
  const plan = account?.plan ?? session?.user?.plan ?? "free"
  const planKey = plan === "premium" || plan === "pro" ? plan : "free"
  const verified = account
    ? Boolean(account.emailVerifiedAt)
    : session?.user?.emailVerified !== false
  const limit = PLAN_LIMIT[planKey]
  const videoCount = typeof account?.videoCount === "number" ? account.videoCount : 0
  const pct = limit ? Math.min(100, (videoCount / limit) * 100) : 0
  const barTone = pct > 85 ? "is-danger" : pct > 60 ? "is-warn" : "is-ok"
  const mismatch = confirm.length > 0 && newPassword !== confirm
  const pending = account?.pendingRequest ?? null
  const subscription = account?.subscription ?? null
  const payments = account?.payments ?? []
  const dueCls = subscription ? dueClass(subscription.status, subscription.nextBillingDate) : ""
  const days = subscription ? daysUntil(subscription.nextBillingDate) : 0

  return (
    <div className="page">
      <AppHeader />
      <main id="conteudo" className="page-wrap page-wrap--narrow">
        <div className="mb-section">
          <h1 className="page-title">Minha conta</h1>
          <p className="page-sub">Perfil, senha e plano em um só lugar</p>
        </div>

        {!verified && (
          <div className="banner banner-warn" role="status">
            <AlertTriangle size={16} />
            <p>Seu e-mail ainda não foi confirmado. Reenvie o link pra manter a conta segura.</p>
            <button
              type="button"
              className="btn btn-compact btn-primary row-end"
              disabled={resending}
              onClick={resendVerification}
            >
              {resending ? "Enviando..." : "Reenviar confirmação"}
            </button>
          </div>
        )}
        {verifyMsg && (
          <p className={`alert mb-section ${verifyMsg.ok ? "alert-ok" : "alert-err"}`} role="status">
            {verifyMsg.text}
          </p>
        )}
        {pendingMsg && (
          <p className={`alert mb-section ${pendingMsg.ok ? "alert-ok" : "alert-err"}`} role="status">
            {pendingMsg.text}
          </p>
        )}
        {pending && (
          <div className="alert-banner banner-warn">
            <p>
              Solicitação de <strong>{PLAN_LABEL[pending.toPlan] ?? pending.toPlan}</strong>
              {pending.toPlan !== "free" ? ` (${BILLING_LABEL[pending.billing]} · ${money(pending.amount)})` : ""} aguardando aprovação da gestão.
            </p>
            <button type="button" className="btn btn-ghost btn-compact" onClick={cancelPending} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Cancelar pedido"}
            </button>
          </div>
        )}

        <div className="card usage-card">
          <div className="account-hero">
            <div className="avatar avatar--lg avatar--accent" aria-hidden="true">
              {initials(displayName, email)}
            </div>
            <div className="account-hero-body">
              <p className="account-hero-name">{displayName}</p>
              <p className="account-hero-email">{email}</p>
              <div className="account-hero-tags">
                <span className={`badge badge-${planKey}`}>{PLAN_LABEL[planKey]}</span>
                {verified ? (
                  <span className="badge badge-ok"><CheckCircle2 size={11} /> E-mail confirmado</span>
                ) : (
                  <span className="badge badge-warn"><Mail size={11} /> E-mail pendente</span>
                )}
                {account?.role === "admin" && <span className="badge badge-admin">Admin</span>}
              </div>
            </div>
            {account?.createdAt && (
              <p className="muted-2 account-since">Membro desde {fmtDateLong(account.createdAt)}</p>
            )}
          </div>
        </div>

        <div className={`plan-card is-current account-plan-card`} data-plan={planKey}>
          <div className="plan-current">ATUAL</div>
          <div className="account-plan">
            <div className="plan-card-head">
              <div className="plan-icon">{planIcon(planKey)}</div>
              <div>
                <p className="list-row-title">Plano {PLAN_LABEL[planKey]}</p>
                <p className="muted-2">{PLAN_HINT[planKey]}</p>
              </div>
            </div>
            <Link href="/plano" className="btn btn-primary">
              <CreditCard size={14} /> Gerenciar plano
            </Link>
          </div>
          {subscription && (
            <div className="account-facts">
              <div className="mini-stat">
                <p>Status</p>
                <strong>
                  <span className={`badge badge-${statusBadgeClass(subscription.status)}`}>
                    {SUB_STATUS_LABEL[subscription.status] ?? subscription.status}
                  </span>
                </strong>
              </div>
              <div className="mini-stat">
                <p>Cobrança</p>
                <strong>{BILLING_LABEL[subscription.billing] ?? subscription.billing}</strong>
              </div>
              <div className="mini-stat">
                <p>Valor</p>
                <strong>{money(subscription.amount)}</strong>
              </div>
              <div className="mini-stat">
                <p>{subscription.status === "cancelled" ? "Cancelada em" : "Próximo vencimento"}</p>
                <strong className={`due-date ${dueCls}`}>
                  {subscription.status === "cancelled" && subscription.cancelledAt
                    ? fmtDate(subscription.cancelledAt)
                    : fmtDate(subscription.nextBillingDate)}
                </strong>
                {subscription.status === "active" && (
                  <p className={`due-sub ${dueCls}`}>
                    {days > 0 ? `em ${days} dia${days !== 1 ? "s" : ""}` : days === 0 ? "hoje" : `${Math.abs(days)}d de atraso`}
                  </p>
                )}
                {subscription.status === "overdue" && (
                  <p className="due-sub is-err">{Math.abs(days)}d em atraso</p>
                )}
              </div>
            </div>
          )}
          {limit ? (
            <>
              <div className="usage-head">
                <p className="muted">{videoCount} / {limit} vídeos na biblioteca</p>
                <p className="muted">{Math.round(pct)}%</p>
              </div>
              <div className="bar-track bar-track--lg">
                <div className={`bar-fill ${barTone}`} style={{ ["--bar-pct" as string]: `${pct}%` }} />
              </div>
            </>
          ) : (
            <p className="ok-text">Armazenamento ilimitado</p>
          )}
        </div>

        <div className="split-2">
          <form onSubmit={saveName} className="card panel-card stack-gap account-form">
            <div className="stat-head">
              <UserRound size={15} color="#1e40af" /> Perfil
            </div>
            <div className="field">
              <label className="field-label" htmlFor="account-name">Nome</label>
              <input
                id="account-name"
                className="input"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setNameOverride(e.target.value)}
                required
                maxLength={80}
                placeholder="Como você quer ser chamado"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="account-email">E-mail</label>
              <input id="account-email" className="input" value={email} readOnly disabled />
              <p className="muted-2">O e-mail não pode ser alterado por aqui.</p>
            </div>
            {nameMsg && (
              <p className={`alert ${nameMsg.ok ? "alert-ok" : "alert-err"}`} role="status">
                {nameMsg.text}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar nome"}
            </button>
          </form>

          <form onSubmit={savePassword} className="card panel-card stack-gap account-form">
            <div className="stat-head">
              <Lock size={15} color="#b45309" /> Trocar senha
            </div>
            <div className="field">
              <label className="field-label" htmlFor="account-current-password">Senha atual</label>
              <div className="input-icon">
                <Lock size={18} aria-hidden />
                <input
                  id="account-current-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="account-new-password">Nova senha</label>
              <div className="input-icon">
                <Lock size={18} aria-hidden />
                <input
                  id="account-new-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  aria-invalid={mismatch}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="account-confirm-password">Confirmar nova senha</label>
              <div className="input-icon">
                <Lock size={18} aria-hidden />
                <input
                  id="account-confirm-password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? "account-confirm-error" : undefined}
                />
              </div>
              {mismatch && <p id="account-confirm-error" className="field-error" role="alert">As senhas não coincidem</p>}
            </div>
            {passMsg && (
              <p className={`alert ${passMsg.ok ? "alert-ok" : "alert-err"}`} role="status">
                {passMsg.text}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={savingPass || mismatch}>
              {savingPass ? "Alterando..." : "Alterar senha"}
            </button>
          </form>
        </div>

        {(subscription || payments.length > 0) && (
          <section className="account-payments" aria-labelledby="pagamentos-titulo">
            <div className="stat-head" id="pagamentos-titulo">
              <Receipt size={15} color="#15803d" /> Histórico de pagamentos
            </div>
            {payments.length === 0 ? (
              <div className="card panel-card">
                <p className="muted">Nenhum pagamento registrado ainda.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Plano</th>
                      <th>Valor</th>
                      <th>Método</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-sub">{fmtDateLong(p.createdAt)}</td>
                        <td>
                          <p className="cell-title">{PLAN_LABEL[p.plan] ?? p.plan}</p>
                          <p className="cell-sub">{BILLING_LABEL[p.billing] ?? p.billing}</p>
                        </td>
                        <td className="cell-title">{money(p.amount)}</td>
                        <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className="card panel-card stack-gap" aria-labelledby="lgpd-titulo" style={{ marginTop: 24 }}>
          <div className="stat-head" id="lgpd-titulo">Seus dados</div>
          <p className="page-sub">Exporte uma cópia JSON ou exclua a conta (anonimização). Pagamentos registrados pela gestão são preservados.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-ghost" href="/api/account/export">Baixar meus dados</a>
            <button type="button" className="btn btn-danger-soft" onClick={() => setConfirmDelete(true)}>
              Excluir minha conta
            </button>
          </div>
        </section>
      </main>
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir sua conta?"
        descricao="Nome, e-mail e conteúdo pessoal serão anonimizados. Você perde o acesso. O histórico de pagamentos permanece com a gestão."
        confirmarLabel="Excluir conta"
        perigo
        carregando={deletingAccount}
        onCancel={() => { if (!deletingAccount) setConfirmDelete(false) }}
        onConfirm={async () => {
          setDeletingAccount(true)
          try {
            await apiRequest("/api/account", { method: "DELETE" })
            await signOutToLogin()
          } catch (err) {
            setDeletingAccount(false)
            setConfirmDelete(false)
            setNameMsg({ text: apiErrorMessage(err, "Não foi possível excluir a conta"), ok: false })
          }
        }}
      />
    </div>
  )
}
