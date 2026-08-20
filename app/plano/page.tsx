"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/app/components/AppHeader"
import { Check, Zap, Crown, Star } from "lucide-react"

type Info = { plan: string; videoCount: number }

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "Grátis",
    icon: <Star size={20} />,
    color: "#64748B",
    bg: "#F8FAFC",
    border: "#E2E8F0",
    limit: "20 vídeos",
    features: ["Até 20 vídeos", "Categorias ilimitadas", "Mini-player", "Compartilhamento"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$ 10,00/mês",
    icon: <Zap size={20} />,
    color: "#7C3AED",
    bg: "#FAF5FF",
    border: "#DDD6FE",
    limit: "100 vídeos",
    features: ["Até 100 vídeos", "Tudo do Free", "Coleções colaborativas", "Estatísticas avançadas"],
    badge: "Mais popular",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 17,90/mês",
    icon: <Crown size={20} />,
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#FDE68A",
    limit: "Ilimitado",
    features: ["Vídeos ilimitados", "Tudo do Premium", "Prioridade no suporte", "Exportar biblioteca"],
  },
]

export default function PlanoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [info, setInfo] = useState<Info | null>(null)

  const currentPlan = (session?.user as { plan?: string })?.plan ?? "free"

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return }
    if (status === "authenticated") {
      fetch("/api/plano").then(r => r.json()).then(setInfo)
    }
  }, [status, router])

  const LIMIT: Record<string, number | null> = { free: 20, premium: 100, pro: null }
  const limit = LIMIT[info?.plan ?? "free"]
  const pct = limit ? Math.min(100, ((info?.videoCount ?? 0) / limit) * 100) : 0

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <AppHeader />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0F172A" }}>Seu Plano</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 6 }}>Escolha o plano ideal para sua biblioteca de vídeos</p>
        </div>

        {/* Uso atual */}
        {info && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "20px 24px", marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Uso atual — plano <strong>{currentPlan}</strong></p>
              <p style={{ fontSize: 13, color: "#64748B" }}>{info.videoCount} / {limit ?? "∞"} vídeos</p>
            </div>
            {limit && (
              <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct > 85 ? "#EF4444" : pct > 60 ? "#F97316" : "#1E40AF", borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            )}
            {!limit && <p style={{ fontSize: 12, color: "#16A34A", marginTop: 4 }}>Armazenamento ilimitado ✓</p>}
          </div>
        )}

        {/* Cards dos planos */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          {PLANS.map(p => {
            const isCurrent = currentPlan === p.id
            return (
              <div key={p.id} style={{ background: p.bg, border: `2px solid ${isCurrent ? p.color : p.border}`, borderRadius: 14, padding: 24, position: "relative" }}>
                {p.badge && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: p.color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    {p.badge}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ position: "absolute", top: 14, right: 14, background: p.color, color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>ATUAL</div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: p.color + "20", display: "flex", alignItems: "center", justifyContent: "center", color: p.color }}>
                    {p.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: "#64748B" }}>{p.limit}</p>
                  </div>
                </div>

                <p style={{ fontSize: 20, fontWeight: 700, color: p.color, marginBottom: 16 }}>{p.price}</p>

                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#475569" }}>
                      <Check size={13} color={p.color} /> {f}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <div style={{ background: "#fff", border: `1px solid ${p.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ fontSize: 12, color: "#64748B", marginBottom: 6, fontWeight: 600 }}>Como contratar:</p>
                    <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                      Faça o pagamento de <strong>{p.price}</strong> via PIX ou cartão e entre em contato com o suporte informando seu e-mail <strong>({session?.user?.email})</strong> para ativação.
                    </p>
                    <div style={{ marginTop: 10, padding: "8px 10px", background: p.bg, border: `1px solid ${p.border}`, borderRadius: 7 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 2 }}>Chave PIX</p>
                      <p style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>contato@geflix.app</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 28 }}>
          Após o pagamento, o admin ativa seu plano em até 24h. Em caso de dúvidas: suporte@geflix.app
        </p>
      </div>
    </div>
  )
}
