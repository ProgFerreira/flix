"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/app/components/Logo"

const iStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "#fff", border: "1px solid #CBD5E1",
  borderRadius: 8, color: "#0F172A", fontSize: 14, outline: "none", fontFamily: "inherit",
}

function RedefinirSenhaForm() {
  const router = useRouter()
  const token = useSearchParams().get("token")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("As senhas não coincidem"); return }

    setLoading(true)
    const res = await fetch("/api/auth/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push("/login"), 2000)
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? "Não foi possível redefinir a senha")
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#DC2626", fontWeight: 600, marginBottom: 8 }}>Link inválido</p>
        <p style={{ fontSize: 13, color: "#64748B" }}>Esse link de redefinição está incompleto. Peça um novo.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#15803D", fontWeight: 600, marginBottom: 8 }}>Senha redefinida!</p>
        <p style={{ fontSize: 13, color: "#64748B" }}>Levando você pro login...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>Escolha uma nova senha pra sua conta.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Nova senha</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" style={iStyle} autoFocus />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Confirmar nova senha</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} placeholder="Repita a senha" style={iStyle} />
      </div>

      {error && (
        <p style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} style={{
        padding: "11px 0", background: "#1E40AF", border: "none", borderRadius: 8,
        color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1, marginTop: 4, fontFamily: "inherit",
      }}>
        {loading ? "Salvando..." : "Redefinir senha"}
      </button>
    </form>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 12px rgba(30,64,175,0.08)" }}>
            <Logo size={26} />
          </div>
          <div><Logo size={30} /></div>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Nova senha</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
          <Suspense fallback={<p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center" }}>Carregando...</p>}>
            <RedefinirSenhaForm />
          </Suspense>
        </div>

        <Link href="/login" style={{ display: "block", textAlign: "center", fontSize: 13, color: "#64748B", textDecoration: "none", marginTop: 20 }}>
          Voltar pro login
        </Link>
      </div>
    </div>
  )
}
