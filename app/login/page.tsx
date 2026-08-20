"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/app/components/Logo"

const iStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "#fff", border: "1px solid #CBD5E1",
  borderRadius: 8, color: "#0F172A", fontSize: 14, outline: "none", fontFamily: "inherit",
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.ok) router.push("/")
    else setMsg({ text: "Email ou senha inválidos", ok: false })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    })
    setLoading(false)
    if (res.ok) {
      setMsg({ text: "Conta criada! Entrando...", ok: true })
      const login = await signIn("credentials", { email, password, redirect: false })
      if (login?.ok) router.push("/")
    } else {
      let message = "Erro ao criar conta"
      try {
        const d = await res.json()
        if (typeof d?.error === "string") message = d.error
      } catch {
        // resposta vazia ou não-JSON
      }
      setMsg({ text: message, ok: false })
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 12px rgba(30,64,175,0.08)" }}>
            <Logo size={26} />
          </div>
          <div>
            <Logo size={30} />
          </div>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>

          {/* Tabs */}
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, marginBottom: 24 }}>
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setMsg(null) }} style={{
                flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#1E40AF" : "#64748B",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "register" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Nome</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" style={iStyle} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" style={iStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Senha</label>
                {mode === "login" && (
                  <Link href="/esqueci-senha" style={{ fontSize: 12, color: "#1E40AF", textDecoration: "none" }}>
                    Esqueci minha senha
                  </Link>
                )}
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" style={iStyle} />
            </div>

            {msg && (
              <p style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: msg.ok ? "#F0FDF4" : "#FEF2F2", color: msg.ok ? "#15803D" : "#DC2626", border: `1px solid ${msg.ok ? "#BBF7D0" : "#FECACA"}` }}>
                {msg.text}
              </p>
            )}

            <button type="submit" disabled={loading} style={{
              padding: "11px 0", background: "#1E40AF", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, marginTop: 4, fontFamily: "inherit",
              transition: "background 0.15s",
            }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 20 }}>
          GEFlix · Gestão de Vídeos Inteligente
        </p>
      </div>
    </div>
  )
}
