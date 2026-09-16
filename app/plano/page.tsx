"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppHeader } from "@/app/components/AppHeader"
import { formatMoney } from "@/lib/money"
import { PLAN_PRICE, SUPPORT_EMAIL } from "@/lib/plans-public"
import { PixBox } from "@/app/components/PixBox"
import { Modal } from "@/app/components/Modal"
import { ReceiptUpload } from "./ReceiptUpload"
import { PLAN_FEATURES, PLAN_LIMITS } from "@/lib/plan-config"
import { loginHref } from "@/lib/auth-redirect"
import { Check, Zap, Crown, Star } from "lucide-react"

type PendingRequest = {
  hasReceipt: boolean
  id: number
  fromPlan: string
  toPlan: string
  billing: string
  amount: string
  createdAt: string
  status: string
}

type Info = {
  plan: string
  videoCount: number
  pendingRequest: PendingRequest | null
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const BILLING_LABEL: Record<string, string> = { monthly: "Mensal", annual: "Anual" }
const PRICE: Record<string, Record<string, number>> = {
  premium: { monthly: PLAN_PRICE.premium.monthly, annual: PLAN_PRICE.premium.annual },
  pro: { monthly: PLAN_PRICE.pro.monthly, annual: PLAN_PRICE.pro.annual },
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "Grátis",
    icon: <Star size={20} />,
    limit: "20 vídeos",
    features: PLAN_FEATURES.free,
  },
  {
    id: "premium",
    name: "Premium",
    price: `R$ ${formatMoney(PLAN_PRICE.premium.monthly)}/mês`,
    icon: <Zap size={20} />,
    limit: "100 vídeos",
    features: PLAN_FEATURES.premium,
    badge: "Mais popular",
  },
  {
    id: "pro",
    name: "Pro",
    price: `R$ ${formatMoney(PLAN_PRICE.pro.monthly)}/mês`,
    icon: <Crown size={20} />,
    limit: "Ilimitado",
    features: PLAN_FEATURES.pro,
  },
]

export default function PlanoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [target, setTarget] = useState<(typeof PLANS)[number] | null>(null)
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push(loginHref("/plano"))
  }, [status, router])

  const infoQuery = useQuery({
    queryKey: ["plano"],
    queryFn: async () => {
      const res = await fetch("/api/plano")
      if (!res.ok) throw new Error("Falha ao carregar plano")
      return res.json() as Promise<Info>
    },
    enabled: status === "authenticated",
    refetchInterval: 30_000,
  })

  const info = infoQuery.data ?? null
  const sessionPlan = (session?.user as { plan?: string })?.plan ?? "free"
  const currentPlan = info?.plan ?? sessionPlan
  const pending = info?.pendingRequest ?? null

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const requestPlan = async () => {
    if (!target) return
    setSaving(true)
    try {
      const res = await fetch("/api/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: target.id,
          billing: target.id === "free" ? undefined : billing,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        flash(data?.error ?? "Não foi possível enviar a solicitação", false)
        return
      }
      setTarget(null)
      flash(`Solicitação do plano ${target.name} enviada. A gestão avalia em até 24h.`)
      await queryClient.invalidateQueries({ queryKey: ["plano"] })
    } catch {
      flash("Não foi possível enviar a solicitação. Tente de novo.", false)
    } finally {
      setSaving(false)
    }
  }

  const cancelRequest = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/plano", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        flash(data?.error ?? "Não foi possível cancelar", false)
        return
      }
      flash("Solicitação cancelada")
      await queryClient.invalidateQueries({ queryKey: ["plano"] })
    } catch {
      flash("Não foi possível cancelar. Tente de novo.", false)
    } finally {
      setSaving(false)
    }
  }

  const configuredLimit = PLAN_LIMITS[currentPlan]
  const limit = Number.isFinite(configuredLimit) ? configuredLimit : null
  const pct = limit ? Math.min(100, ((info?.videoCount ?? 0) / limit) * 100) : 0
  const barTone = pct > 85 ? "is-danger" : pct > 60 ? "is-warn" : ""
  const targetPrice = target && target.id !== "free" ? PRICE[target.id]?.[billing] ?? 0 : 0

  return (
    <div className="page">
      <AppHeader />

      <main id="conteudo" className="page-wrap page-wrap--narrow">
        <div className="page-lead">
          <h1 className="page-title">Seu Plano</h1>
          <p className="page-sub">Escolha um plano, envie o comprovante do PIX e acompanhe a confirmação por aqui.</p>
        </div>

        <ol className="checkout-steps" aria-label="Etapas da contratação"><li>1. Escolher plano</li><li>2. Pagar e enviar comprovante</li><li>3. Aguardar confirmação</li></ol>
        {infoQuery.isError && <div className="alert alert-err" role="alert">Não foi possível carregar seu plano. <button className="btn btn-ghost" onClick={() => infoQuery.refetch()}>Tentar novamente</button></div>}
        {infoQuery.isLoading && <p role="status">Carregando seu plano...</p>}

        {msg && (
          <div className={`alert mb-section ${msg.ok ? "alert-ok" : "alert-err"}`} role="status">{msg.text}</div>
        )}

        {pending && (
          <div className="alert-banner banner-warn">
            <p>
              Solicitação de <strong>{PLAN_LABEL[pending.toPlan] ?? pending.toPlan}</strong>
              {pending.toPlan !== "free" ? ` (${BILLING_LABEL[pending.billing]} · R$ ${formatMoney(pending.amount)})` : ""} aguardando aprovação da gestão.
            </p>
            <button type="button" className="btn btn-ghost btn-compact" onClick={cancelRequest} disabled={saving}>
              Cancelar pedido
            </button>
          </div>
        )}

        {pending && pending.toPlan !== "free" && (
          <section className="checkout-panel" aria-label="Pagamento do pedido">
            <h2 className="page-title">Pedido #{pending.id} · R$ {formatMoney(pending.amount)}</h2>
            <p className="page-sub">{pending.hasReceipt ? "Comprovante recebido. Pagamento em análise." : "Aguardando pagamento e envio do comprovante."}</p>
            <PixBox />
            <ReceiptUpload requestId={pending.id} hasReceipt={pending.hasReceipt} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ["plano"] }) }} />
          </section>
        )}

        {info && (
          <div className="usage-card">
            <div className="usage-head">
              <p className="muted">Uso atual — plano <strong>{PLAN_LABEL[currentPlan] ?? currentPlan}</strong></p>
              <p className="muted">{info.videoCount} / {limit ?? "∞"} vídeos</p>
            </div>
            {limit && (
              <div className="bar-track bar-track--lg">
                <div className={`bar-fill ${barTone}`} style={{ ["--bar-pct" as string]: `${pct}%` }} />
              </div>
            )}
            {!limit && <p className="ok-text">Vídeos ilimitados na biblioteca ✓</p>}
          </div>
        )}

        <div className="plan-grid">
          {PLANS.map(p => {
            const isCurrent = currentPlan === p.id
            const isRequested = pending?.toPlan === p.id
            return (
              <div
                key={p.id}
                className={`plan-card${isCurrent ? " is-current" : ""}${isRequested ? " is-requested" : ""}`}
                data-plan={p.id}
              >
                {p.badge && <div className="plan-flag">{p.badge}</div>}
                {isCurrent && <div className="plan-current">ATUAL</div>}
                {isRequested && <div className="plan-current">SOLICITADO</div>}

                <div className="plan-card-head">
                  <div className="plan-icon">{p.icon}</div>
                  <div>
                    <p className="list-row-title">{p.name}</p>
                    <p className="muted-2">{p.limit}</p>
                  </div>
                </div>

                <p className="plan-price">{p.price}</p>

                <ul className="plan-features">
                  {p.features.map(f => (
                    <li key={f}><Check size={13} /> {f}</li>
                  ))}
                </ul>

                {!isCurrent && (
                  <div className="plan-hire">
                    {isRequested ? (
                      <>
                        <p className="hire-label">Pedido enviado</p>
                        <p>
                          A gestão confirma o pagamento e ativa o plano {p.name}.
                          {p.id !== "free" && pending && (
                            <> Valor: <strong>R$ {formatMoney(pending.amount)}</strong> ({BILLING_LABEL[pending.billing]}).</>
                          )}
                        </p>

                        <button type="button" className="btn btn-ghost btn-block" onClick={cancelRequest} disabled={saving}>
                          Cancelar solicitação
                        </button>
                      </>
                    ) : pending ? (
                      <p>Cancele o pedido pendente para solicitar outro plano.</p>
                    ) : (
                      <>
                        <p className="hire-label">{p.id === "free" ? "Voltar ao Free" : "Como contratar"}</p>
                        <p>
                          {p.id === "free"
                            ? "A gestão confirma a troca. Você perde os recursos dos planos pagos."
                            : "Envie o pedido, pague via PIX e aguarde a gestão ativar."}
                        </p>
                        <button
                          type="button"
                          className={`btn btn-block ${p.id === "free" ? "btn-ghost" : "btn-primary"}`}
                          disabled={infoQuery.isLoading || infoQuery.isError}
                          onClick={() => { setTarget(p); setBilling("monthly") }}
                        >
                          Solicitar {p.name}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="center-note">
          Após o PIX, a gestão ativa o plano em até 24h. Dúvidas: {SUPPORT_EMAIL}
        </p>
      </main>

      {target && (
        <Modal open title={`Solicitar plano ${target.name}`} description="Revise o plano e o valor. Você receberá as instruções de pagamento após enviar o pedido." busy={saving} onClose={() => setTarget(null)}>

            {target.id !== "free" && (
              <div className="stack-gap mb-section">
                <div className="field">
                  <label className="field-label">Cobrança</label>
                  <div className="choice-row">
                    <button type="button" className={`choice${billing === "monthly" ? " is-on" : ""}`} onClick={() => setBilling("monthly")}>
                      Mensal
                      <small>R$ {formatMoney(PRICE[target.id].monthly)}</small>
                    </button>
                    <button type="button" className={`choice${billing === "annual" ? " is-accent" : ""}`} onClick={() => setBilling("annual")}>
                      Anual (20% off)
                      <small>R$ {formatMoney(PRICE[target.id].annual)}</small>
                    </button>
                  </div>
                </div>
                <div className="renew-box">
                  <p className="muted">Valor a pagar</p>
                  <p className="money">R$ {formatMoney(targetPrice)}</p>
                  <p className="text-xs">{BILLING_LABEL[billing]}</p>
                </div>
                <p className="muted">O acesso será liberado após a confirmação do pagamento.</p>
              </div>
            )}

            {target.id === "free" && (
              <div className="alert alert-err mb-section">
                Você volta ao plano Free e perde o acesso aos recursos pagos.
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setTarget(null)} disabled={saving} className="btn btn-ghost">Voltar</button>
              <button type="button" onClick={requestPlan} disabled={saving} className="btn btn-primary is-wide">
                {saving ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}
