"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Users, DollarSign, LayoutDashboard, ClipboardList, ScrollText, BookOpen, Layers, Film } from "lucide-react"

export function AdminSubnav({
  path,
  onNavigate,
}: {
  path: string
  onNavigate: () => void
}) {
  const adminLink = (href: string, label: string, icon: ReactNode) => {
    const active = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`)
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={`app-nav-link${active ? " is-active" : ""}`} onClick={onNavigate}>
        {icon} {label}
      </Link>
    )
  }

  return (
    <nav className="admin-subnav" aria-label="Administração">
      <div className="admin-subnav-inner">
        {adminLink("/admin", "Painel", <LayoutDashboard size={14} />)}
        {adminLink("/admin/clientes", "Clientes", <Users size={14} />)}
        {adminLink("/admin/pagamentos", "Pagamentos", <DollarSign size={14} />)}
        {adminLink("/admin/assinaturas", "Assinaturas", <Layers size={14} />)}
        {adminLink("/admin/solicitacoes", "Solicitações", <ClipboardList size={14} />)}
        {adminLink("/admin/auditoria", "Auditoria", <ScrollText size={14} />)}
        {adminLink("/admin/videos", "Vídeos", <Film size={14} />)}
        {adminLink("/admin/cursos", "Cursos", <BookOpen size={14} />)}
      </div>
    </nav>
  )
}
