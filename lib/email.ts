import { Resend } from "resend"

const FROM = process.env.EMAIL_FROM ?? "Flix <onboarding@resend.dev>"

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

async function sendMail(to: string, subject: string, html: string, devLabel: string): Promise<void> {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] RESEND_API_KEY não configurada — ${devLabel} pra ${to}`)
    } else {
      console.error(`[email] RESEND_API_KEY não configurada — ${devLabel} não enviado`)
    }
    return
  }
  await client.emails.send({ from: FROM, to, subject, html })
}

/**
 * Sem RESEND_API_KEY configurada, o pedido de reset continua respondendo
 * normalmente (pra não vazar se o e-mail existe ou não) mas nenhum e-mail
 * sai de verdade. Em dev, loga o link no console do servidor pra dar pra
 * testar o fluxo sem precisar de uma conta no Resend.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] RESEND_API_KEY não configurada — link de reset pra ${to}: ${resetUrl}`)
    } else {
      console.error("[email] RESEND_API_KEY não configurada — e-mail de reset não enviado")
    }
    return
  }

  await client.emails.send({
    from: FROM,
    to,
    subject: "Redefinir sua senha",
    html: `
      <p>Recebemos um pedido pra redefinir a senha da sua conta.</p>
      <p><a href="${resetUrl}">Clique aqui pra criar uma nova senha</a>. O link expira em 1 hora.</p>
      <p>Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>
    `,
  })
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] RESEND_API_KEY não configurada — link de verificação pra ${to}: ${verifyUrl}`)
    } else {
      console.error("[email] RESEND_API_KEY não configurada — e-mail de verificação não enviado")
    }
    return
  }

  await client.emails.send({
    from: FROM,
    to,
    subject: "Confirme seu e-mail",
    html: `
      <p>Confirme o e-mail da sua conta no GEFlix.</p>
      <p><a href="${verifyUrl}">Clique aqui pra confirmar</a>. O link expira em 24 horas.</p>
      <p>Se você não criou essa conta, pode ignorar este e-mail.</p>
    `,
  })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }

function appUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
  return `${base}${path}`
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

export async function sendBillingUpcomingEmail(opts: {
  to: string
  name?: string | null
  plan: string
  amount: string
  dueDate: Date
  daysLeft: number
}): Promise<void> {
  const who = escapeHtml(opts.name ? opts.name.split(" ")[0] : "olá")
  const plan = PLAN_LABEL[opts.plan] ?? opts.plan
  await sendMail(
    opts.to,
    `Sua assinatura ${plan} vence em ${opts.daysLeft} dia${opts.daysLeft === 1 ? "" : "s"}`,
    `
      <p>${who}, a assinatura <strong>${plan}</strong> vence em ${fmtDate(opts.dueDate)} (R$ ${escapeHtml(opts.amount)}).</p>
      <p>Envie o PIX e avise a gente pelo app pra renovar o acesso.</p>
      <p><a href="${appUrl("/plano")}">Abrir meu plano</a></p>
    `,
    `lembrete de vencimento`,
  )
}

export async function sendBillingOverdueEmail(opts: {
  to: string
  name?: string | null
  plan: string
  amount: string
  dueDate: Date
}): Promise<void> {
  const who = escapeHtml(opts.name ? opts.name.split(" ")[0] : "olá")
  const plan = PLAN_LABEL[opts.plan] ?? opts.plan
  await sendMail(
    opts.to,
    `Assinatura ${plan} em atraso`,
    `
      <p>${who}, a assinatura <strong>${plan}</strong> venceu em ${fmtDate(opts.dueDate)} (R$ ${escapeHtml(opts.amount)}) e ainda não consta o pagamento.</p>
      <p>Há alguns dias de tolerância. Depois disso o acesso volta para o plano Free.</p>
      <p><a href="${appUrl("/plano")}">Regularizar no app</a></p>
    `,
    `lembrete de atraso`,
  )
}

