"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Logo } from "@/app/components/Logo"
import { loginSchema, signupSchema } from "@/validators/auth"
import { apiErrorMessage, apiRequest } from "@/lib/api-client"
import type { z } from "zod"

import { useUrlState } from "@/app/hooks/useUrlState"
import { safeReturnTo } from "@/lib/auth-redirect"
import { Eye, EyeOff, FolderOpen, Clapperboard, ShieldCheck, Mail, Lock, UserRound } from "lucide-react"

type LoginValues = z.infer<typeof loginSchema>
type SignupValues = z.infer<typeof signupSchema>

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useUrlState<"login" | "register">("mode", "login", v => v === "register" ? "register" : "login")
  const [returnTo] = useUrlState("returnTo", "/", safeReturnTo)
  const [showPassword, setShowPassword] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  })
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", name: "", acceptedTerms: false },
  })

  const onLogin = loginForm.handleSubmit(async (data) => {
    setMsg(null)
    try {
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      remember: data.remember ? "true" : "false",
      redirect: false,
    })
    if (res?.ok) router.push(safeReturnTo(returnTo))
    else setMsg({ text: "E-mail ou senha inválidos", ok: false })
    } catch { setMsg({ text: "Não foi possível conectar. Tente novamente.", ok: false }) }
  })

  const onRegister = signupForm.handleSubmit(async (data) => {
    setMsg(null)
    try {
      await apiRequest("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      setMsg({ text: "Conta criada! Enviamos um e-mail de confirmação. Entrando...", ok: true })
      const login = await signIn("credentials", {
        email: data.email,
        password: data.password,
        remember: "false",
        redirect: false,
      })
      if (login?.ok) router.push(safeReturnTo(returnTo))
    } catch (err) {
      setMsg({ text: apiErrorMessage(err, "Erro ao criar conta"), ok: false })
    }
  })

  const loading = loginForm.formState.isSubmitting || signupForm.formState.isSubmitting

  return (
    <div className="auth-page auth-split">
      <aside className="auth-intro">
        <Logo size={32} />
        <h1>Seus vídeos, organizados.<br />Seu próximo conteúdo, aqui.</h1>
        <p>Guarde o que vale assistir e descubra conteúdos exclusivos.</p>
        <ul className="auth-benefits">
          <li><FolderOpen aria-hidden /><div><strong>Sua biblioteca</strong><p>Organize links, favoritos e coleções em um só lugar.</p></div></li>
          <li><Clapperboard aria-hidden /><div><strong>Conteúdo para descobrir</strong><p>Explore o catálogo e retome de onde parou.</p></div></li>
          <li><ShieldCheck aria-hidden /><div><strong>Comece gratuitamente</strong><p>Escolha um plano pago quando precisar de mais recursos.</p></div></li>
        </ul>
      </aside>
      <div className="auth-box">
        <div className="auth-brand">
          <Logo size={30} />
          <p className="auth-sub">{mode === "login" ? "Organize o YouTube que você escolheu e assista o clube do criador" : "Conta grátis: biblioteca pessoal + catálogo free. PIX só se quiser um plano pago."}</p>
        </div>

        <div className="auth-card">
          <h2 className="page-title">{mode === "login" ? "Bem-vindo de volta" : "Crie sua conta gratuita"}</h2>
          <p className="page-sub mb-section">{mode === "login" ? "Entre para continuar de onde parou." : "Organize seus primeiros vídeos em poucos passos."}</p>
          <div className="auth-tabs" role="tablist" aria-label="Entrar ou cadastrar">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`auth-tab${mode === m ? " is-active" : ""}`}
                onClick={() => { setMode(m); setMsg(null) }}
              >
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <form onSubmit={onLogin} className="auth-form">
              <div className="field">
                <label className="field-label" htmlFor="login-email">Email</label>
                <div className="input-icon"><Mail size={18} aria-hidden /><input id="login-email" className="input" aria-invalid={Boolean(loginForm.formState.errors.email)} aria-describedby={loginForm.formState.errors.email ? "login-email-error" : undefined} type="email" autoComplete="email" placeholder="seu@email.com" {...loginForm.register("email")} /></div>
                {loginForm.formState.errors.email && <p id="login-email-error" className="field-error" role="alert">{loginForm.formState.errors.email.message}</p>}
              </div>
              <div className="field">
                <div className="field-row">
                  <label className="field-label" htmlFor="login-password">Senha</label>
                  <Link href="/esqueci-senha" className="link">Esqueci minha senha</Link>
                </div>
                <div className="input-icon"><Lock size={18} aria-hidden /><input id="login-password" className="input" aria-invalid={Boolean(loginForm.formState.errors.password)} aria-describedby={loginForm.formState.errors.password ? "login-password-error" : undefined} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" {...loginForm.register("password")} /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                {loginForm.formState.errors.password && <p id="login-password-error" className="field-error" role="alert">{loginForm.formState.errors.password.message}</p>}
              </div>
              <label className="field-check">
                <input type="checkbox" {...loginForm.register("remember")} />
                <span>Manter conectado por 30 dias</span>
              </label>
              {msg && <p role="status" className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Aguarde..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={onRegister} className="auth-form">
              <div className="field">
                <label className="field-label" htmlFor="signup-name">Nome</label>
                <div className="input-icon"><UserRound size={18} aria-hidden /><input id="signup-name" className="input" aria-invalid={Boolean(signupForm.formState.errors.name)} aria-describedby={signupForm.formState.errors.name ? "signup-name-error" : undefined} type="text" autoComplete="name" placeholder="Seu nome" {...signupForm.register("name")} /></div>
                {signupForm.formState.errors.name && <p id="signup-name-error" className="field-error" role="alert">{signupForm.formState.errors.name.message}</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="signup-email">Email</label>
                <div className="input-icon"><Mail size={18} aria-hidden /><input id="signup-email" className="input" aria-invalid={Boolean(signupForm.formState.errors.email)} aria-describedby={signupForm.formState.errors.email ? "signup-email-error" : undefined} type="email" autoComplete="email" placeholder="seu@email.com" {...signupForm.register("email")} /></div>
                {signupForm.formState.errors.email && <p id="signup-email-error" className="field-error" role="alert">{signupForm.formState.errors.email.message}</p>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="signup-password">Senha</label>
                <div className="input-icon"><Lock size={18} aria-hidden /><input id="signup-password" className="input" aria-invalid={Boolean(signupForm.formState.errors.password)} aria-describedby={signupForm.formState.errors.password ? "signup-password-error" : undefined} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...signupForm.register("password")} /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                {signupForm.formState.errors.password && <p id="signup-password-error" className="field-error" role="alert">{signupForm.formState.errors.password.message}</p>}
              </div>
              <label className="field-check" htmlFor="signup-terms">
                <input id="signup-terms" type="checkbox" aria-invalid={Boolean(signupForm.formState.errors.acceptedTerms)} aria-describedby={signupForm.formState.errors.acceptedTerms ? "signup-terms-error" : undefined} {...signupForm.register("acceptedTerms")} />
                <span>
                  Li e aceito os <Link href="/termos" className="link">termos de uso</Link>
                  {" "}e a <Link href="/privacidade" className="link">política de privacidade</Link>.
                </span>
              </label>
              {signupForm.formState.errors.acceptedTerms && <p id="signup-terms-error" className="alert alert-err" role="alert">{signupForm.formState.errors.acceptedTerms.message}</p>}
              {msg && <p role="status" className={`alert ${msg.ok ? "alert-ok" : "alert-err"}`}>{msg.text}</p>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? "Aguarde..." : "Criar conta"}
              </button>
            </form>
          )}
        </div>

        <p className="auth-footer">GEFlix · Gestão de vídeos + clube do criador</p>
        <Link href="/catalogo" className="auth-back">Ver o catálogo sem conta</Link>
      </div>
    </div>
  )
}
