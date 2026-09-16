"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Lock } from "lucide-react"
import { Logo } from "@/app/components/Logo"
import { resetPasswordFormSchema, resetPasswordSchema } from "@/validators/auth"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import type { z } from "zod"

type FormValues = z.infer<typeof resetPasswordFormSchema>

function RedefinirSenhaForm() {
  const router = useRouter()
  const token = useSearchParams().get("token")
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirm: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    const parsed = resetPasswordSchema.safeParse({ token: token ?? "", password: data.password })
    if (!parsed.success) {
      form.setError("password", { message: parsed.error.issues[0]?.message ?? "Link inválido" })
      return
    }
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      setDone(true)
      setTimeout(() => router.push("/login"), 2000)
    } catch (err) {
      form.setError("password", { message: apiErrorMessage(err, "Não foi possível redefinir a senha") })
    }
  })

  if (!token) {
    return (
      <div className="auth-result">
        <p className="alert alert-err" role="alert">Link inválido</p>
        <p className="page-sub mt">Esse link de redefinição está incompleto. Peça um novo.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-result">
        <p className="auth-result-title is-ok">Senha redefinida!</p>
        <p className="page-sub">Levando você pro login...</p>
      </div>
    )
  }

  const passwordError = form.formState.errors.password
  const confirmError = form.formState.errors.confirm

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <p className="page-sub">Escolha uma nova senha pra sua conta.</p>
      <div className="field">
        <label className="field-label" htmlFor="reset-password">Nova senha</label>
        <div className="input-icon">
          <Lock size={18} aria-hidden />
          <input
            id="reset-password"
            className="input"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            autoFocus
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "reset-password-error" : undefined}
            {...form.register("password")}
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {passwordError && <p id="reset-password-error" className="field-error" role="alert">{passwordError.message}</p>}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="reset-confirm">Confirmar nova senha</label>
        <div className="input-icon">
          <Lock size={18} aria-hidden />
          <input
            id="reset-confirm"
            className="input"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a senha"
            aria-invalid={Boolean(confirmError)}
            aria-describedby={confirmError ? "reset-confirm-error" : undefined}
            {...form.register("confirm")}
          />
        </div>
        {confirmError && <p id="reset-confirm-error" className="field-error" role="alert">{confirmError.message}</p>}
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <Logo size={30} />
          <p className="auth-sub">Nova senha</p>
        </div>
        <div className="auth-card">
          <Suspense fallback={<p className="page-sub center">Carregando...</p>}>
            <RedefinirSenhaForm />
          </Suspense>
        </div>
        <Link href="/login" className="auth-back">Voltar pro login</Link>
      </div>
    </div>
  )
}
