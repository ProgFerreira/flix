import { Resend } from "resend"

const FROM = process.env.EMAIL_FROM ?? "Flix <onboarding@resend.dev>"

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
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
