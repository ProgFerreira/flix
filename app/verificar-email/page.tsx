"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Logo } from "@/app/components/Logo"

function VerificarEmailForm() {
  const router = useRouter()
  const { update } = useSession()
  const token = useSearchParams().get("token")

  const query = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? "Não foi possível confirmar o e-mail")
      }
      await update({ emailVerified: true }).catch(() => undefined)
      setTimeout(() => router.push("/"), 1600)
      return true
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  })

  if (!token) {
    return (
      <div className="auth-result">
        <p className="alert alert-err">Link inválido</p>
        <p className="page-sub mt">Peça um novo link em Conta, se você já estiver logado.</p>
      </div>
    )
  }

  if (query.isPending) {
    return <p className="page-sub center">Confirmando seu e-mail...</p>
  }
  if (query.isSuccess) {
    return (
      <div className="auth-result">
        <p className="auth-result-title is-ok">E-mail confirmado!</p>
        <p className="page-sub">Levando você pra biblioteca...</p>
      </div>
    )
  }
  return (
    <div className="auth-result">
      <p className="alert alert-err">{query.error instanceof Error ? query.error.message : "Não foi possível confirmar o e-mail"}</p>
      <p className="page-sub mt">Peça um novo link em Conta, se você já estiver logado.</p>
    </div>
  )
}

export default function VerificarEmailPage() {
  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <Logo size={30} />
          <p className="auth-sub">Confirmar e-mail</p>
        </div>
        <div className="auth-card">
          <Suspense fallback={<p className="page-sub center">Carregando...</p>}>
            <VerificarEmailForm />
          </Suspense>
        </div>
        <Link href="/login" className="auth-back">Voltar pro login</Link>
      </div>
    </div>
  )
}
