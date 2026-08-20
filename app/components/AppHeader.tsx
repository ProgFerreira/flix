"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { BarChart2, History, LogOut, CreditCard, ShieldCheck, Layers, Clapperboard, Film } from "lucide-react"
import { Logo } from "@/app/components/Logo"

export function AppHeader() {
  const { data: session } = useSession()
  const path = usePathname()

  const navLink = (href: string, label: string, icon: React.ReactNode) => {
    const active = path === href
    return (
      <Link href={href} style={{
        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
        borderRadius: 6, textDecoration: "none", fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? "#1E40AF" : "#64748B",
        background: active ? "#EFF6FF" : "transparent",
        border: `1px solid ${active ? "#BFDBFE" : "transparent"}`,
        transition: "all 0.15s",
      }}>
        {icon} {label}
      </Link>
    )
  }

  return (
    <header style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", height: 58, display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <Logo size={22} />
        </Link>

        <div style={{ width: 1, height: 20, background: "#E2E8F0", flexShrink: 0 }} />

        <nav style={{ display: "flex", gap: 4 }}>
          {navLink("/catalogo", "Catálogo", <Clapperboard size={14} />)}
          {navLink("/historico", "Histórico", <History size={14} />)}
          {navLink("/estatisticas", "Estatísticas", <BarChart2 size={14} />)}
          {navLink("/plano", "Meu Plano", <CreditCard size={14} />)}
          {(session?.user as { role?: string })?.role === "admin" && navLink("/admin", "Admin", <ShieldCheck size={14} />)}
          {(session?.user as { role?: string })?.role === "admin" && navLink("/admin/assinaturas", "Assinaturas", <Layers size={14} />)}
          {(session?.user as { role?: string })?.role === "admin" && navLink("/admin/videos", "Vídeos Autorais", <Film size={14} />)}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {session?.user?.name && (
            <span style={{ fontSize: 13, color: "#64748B" }}>
              Olá, <strong style={{ color: "#0F172A" }}>{session.user.name.split(" ")[0]}</strong>
            </span>
          )}
          {session && (
            <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid #E2E8F0", cursor: "pointer", color: "#64748B", fontSize: 13 }}>
              <LogOut size={13} /> Sair
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
