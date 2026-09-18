"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOutToLogin } from "@/lib/sign-out"
import { BarChart2, History, LogOut, CreditCard, Clapperboard, FolderOpen, UserRound, Menu, X, LayoutDashboard } from "lucide-react"
import { loginHref } from "@/lib/auth-redirect"
import { Logo } from "@/app/components/Logo"

const AdminSubnav = dynamic(
  () => import("@/app/components/AdminSubnav").then((mod) => mod.AdminSubnav),
)

export function VisitorHeader() {
  return (
    <>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/catalogo" className="logo-link">
            <Logo size={22} />
          </Link>
          <div className="app-header-visitor">
            <Link href="/catalogo" className="btn btn-ghost">Catálogo</Link>
            <Link href={loginHref("/catalogo")} className="btn btn-ghost">Entrar</Link>
            <Link href={loginHref("/catalogo", true)} className="btn btn-primary">Criar conta</Link>
          </div>
        </div>
      </header>
    </>
  )
}

export function AppHeader() {
  const { data: session } = useSession()
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const role = session?.user?.role

  const navLink = (href: string, label: string, icon: ReactNode) => {
    const active = href === "/admin" ? path.startsWith("/admin") : path === href
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={`app-nav-link${active ? " is-active" : ""}`} onClick={() => setOpen(false)}>
        {icon} {label}
      </Link>
    )
  }

  return (
    <>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <header className={`app-header${open ? " is-open" : ""}`}>
      <div className="app-header-inner">
        <Link href="/" className="logo-link">
          <Logo size={22} />
        </Link>

        <div className="app-header-rule" />

        <button
          type="button"
          className="app-nav-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="app-nav" id="app-nav" aria-label="Principal">
          {navLink("/", "Minha biblioteca", <FolderOpen size={14} />)}
          {navLink("/catalogo", "Explorar catálogo", <Clapperboard size={14} />)}
          {!path.startsWith("/admin") ? navLink("/historico", "Histórico", <History size={14} />) : null}
          {!path.startsWith("/admin") ? navLink("/estatisticas", "Estatísticas", <BarChart2 size={14} />) : null}
          {navLink("/plano", "Meu Plano", <CreditCard size={14} />)}
          {role === "admin" && !path.startsWith("/admin") ? navLink("/admin", "Admin", <LayoutDashboard size={14} />) : null}
        </nav>

        <div className="app-header-actions">
          {session?.user?.name ? (
            <span className="app-header-hello">
              Olá, <strong>{session.user.name.split(" ")[0]}</strong>
            </span>
          ) : null}
          {session ? navLink("/conta", "Conta", <UserRound size={14} />) : null}
          {session ? (
            <button type="button" className="btn btn-ghost" onClick={() => void signOutToLogin()}>
              <LogOut size={13} /> Sair
            </button>
          ) : null}
        </div>
      </div>
      {role === "admin" && path.startsWith("/admin") ? (
        <AdminSubnav path={path} onNavigate={() => setOpen(false)} />
      ) : null}
    </header>
      {session && session.user.emailVerified === false ? (
        <div className="banner verify-banner" role="status">
          <p>
            Confirme seu e-mail pra manter a conta segura.
            {" "}
            <Link href="/conta" className="link">Reenviar confirmação</Link>
          </p>
        </div>
      ) : null}
    </>
  )
}
