"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/app/components/Logo"

const iStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "#fff", border: "1px solid #CBD5E1",
  borderRadius: 8, color: "#0F172A", fontSize: 14, outline: "none", fontFamily: "inherit",
}

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) setSent(true)
    else setError("Não foi possível processar o pedido. Tente de novo.")
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 16, background: "#fff", border: "1px solid #E2E8F0", marginBottom: 16, boxShadow: "0 2px 12px rgba(30,64,175,0.08)" }}>
            <Logo size={26} />
          </div>
          <div><Logo size={30} /></div>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Recuperar senha</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#0F172A", fontWeight: 600, marginBottom: 8 }}>Verifique seu e-mail</p>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                Se <strong>{email}</strong> tiver uma conta, enviamos um link pra você criar uma nova senha. O link vale por 1 hora.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>
                Digite o e-mail da sua conta e enviamos um link pra você redefinir a senha.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" style={iStyle} autoFocus />
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
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          )}
        </div>

        <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, color: "#64748B", textDecoration: "none", marginTop: 20 }}>
          <ArrowLeft size={13} /> Voltar pro login
        </Link>
      </div>
    </div>
  )
}
