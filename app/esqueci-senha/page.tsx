"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Mail } from "lucide-react"
import { Logo } from "@/app/components/Logo"
import { forgotPasswordSchema } from "@/validators/auth"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"

type FormValues = { email: string }

export default function EsqueciSenhaPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const form = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      setSentEmail(data.email)
      setSent(true)
    } catch (err) {
      form.setError("email", { message: apiErrorMessage(err, "Não foi possível processar o pedido. Tente de novo.") })
    }
  })

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <Logo size={30} />
          <p className="auth-sub">Recuperar senha</p>
        </div>

        <div className="auth-card">
          {sent ? (
            <div className="auth-result">
              <p className="auth-result-title">Verifique seu e-mail</p>
              <p className="page-sub is-lead">
                Se <strong>{sentEmail}</strong> tiver uma conta, enviamos um link pra você criar uma nova senha. O link vale por 1 hora.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="auth-form">
              <p className="page-sub">Digite o e-mail da sua conta e enviamos um link pra você redefinir a senha.</p>
              <div className="field">
                <label className="field-label" htmlFor="forgot-email">Email</label>
                <div className="input-icon">
                  <Mail size={18} aria-hidden />
                  <input
                    id="forgot-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    autoFocus
                    aria-invalid={Boolean(form.formState.errors.email)}
                    aria-describedby={form.formState.errors.email ? "forgot-email-error" : undefined}
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && <p id="forgot-email-error" className="field-error" role="alert">{form.formState.errors.email.message}</p>}
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          )}
        </div>

        <Link href="/login" className="auth-back"><ArrowLeft size={13} /> Voltar pro login</Link>
      </div>
    </div>
  )
}
