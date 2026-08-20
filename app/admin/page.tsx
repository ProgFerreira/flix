"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/app/components/AppHeader"
import {
  Trash2, ShieldOff, ShieldCheck, CreditCard, RefreshCw,
  Crown, Users, BarChart2, DollarSign, X, Plus, Receipt, ChevronRight,
} from "lucide-react"

type User = {
  id: number; name: string | null; email: string
  role: string; plan: string; status: string; createdAt: string
  _count: { videos: number }
}

type Payment = {
  id: number; plan: string; amount: number; method: string; note?: string | null; createdAt: string
  user?: { name: string | null; email: string }
}

type UserDetail = {
  payments: Payment[]
  user: { id: number; name: string | null; email: string; plan: string; _count: { videos: number } }
}

const PLAN_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free:    { label: "Free",    color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
  premium: { label: "Premium", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  pro:     { label: "Pro",     color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
}

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX", card: "Cartão", manual: "Manual", boleto: "Boleto",
}

function PlanBadge({ plan }: { plan: string }) {
  const s = PLAN_STYLE[plan] ?? PLAN_STYLE.free
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "2px 8px", borderRadius: 20 }}>
      {s.label}
    </span>
  )
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]       = useState<User[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<"users" | "payments">("users")
  const [search, setSearch]     = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null)

  // Painel lateral: histórico de pagamentos de um usuário
  const [drawer, setDrawer]         = useState<UserDetail | null>(null)
  const [drawerLoading, setDL]      = useState(false)

  // Formulário de novo pagamento (dentro do drawer)
  const [newPlan, setNewPlan]       = useState("premium")
  const [newBilling, setNewBilling] = useState("monthly")
  const [newMethod, setNewMethod]   = useState("pix")
  const [newNote, setNewNote]       = useState("")
  const [newAmount, setNewAmount]   = useState("")
  const [saving, setSaving]         = useState(false)

  const isAdmin = (session?.user as { role?: string })?.role === "admin"

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [u, p] = await Promise.all([
      fetch("/api/admin/users").then(r => r.json()),
      fetch("/api/admin/payments").then(r => r.json()),
    ])
    if (Array.isArray(u)) setUsers(u)
    if (Array.isArray(p)) setPayments(p)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    if (!isAdmin) { router.push("/"); return }
    fetchData()
  }, [status, isAdmin, fetchData, router])

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  // Abrir drawer de um usuário
  const openDrawer = async (userId: number) => {
    setDL(true); setDrawer(null)
    const res = await fetch(`/api/admin/payments/${userId}`)
    const data: UserDetail = await res.json()
    setDrawer(data)
    setNewPlan(data.user.plan === "free" ? "premium" : data.user.plan === "premium" ? "pro" : "premium")
    setNewBilling("monthly")
    setNewMethod("pix")
    setNewNote("")
    setNewAmount("")
    setDL(false)
  }

  const patchUser = async (id: number, data: Record<string, string>) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    })
    if (res.ok) { fetchData(); flash("Atualizado com sucesso") }
    else flash("Erro ao atualizar", false)
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Excluir permanentemente "${user.name ?? user.email}"? Todos os dados serão removidos.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    if (res.ok) { fetchData(); flash("Usuário excluído") }
    else flash("Erro ao excluir", false)
  }

  const registerPayment = async () => {
    if (!drawer) return
    setSaving(true)
    const amount = newAmount ? parseFloat(newAmount) : undefined
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: drawer.user.id, plan: newPlan, billing: newBilling, method: newMethod, note: newNote || undefined, amount }),
    })
    setSaving(false)
    if (res.ok) {
      flash(`Pagamento registrado — plano ${newPlan} ativado`)
      await Promise.all([fetchData(), openDrawer(drawer.user.id)])
    } else flash("Erro ao registrar pagamento", false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (!q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q))
      && (planFilter === "all" || u.plan === planFilter)
  })

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    free: users.filter(u => u.plan === "free").length,
    premium: users.filter(u => u.plan === "premium").length,
    pro: users.filter(u => u.plan === "pro").length,
    revenue: payments.reduce((s, p) => s + p.amount, 0),
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
        <AppHeader />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#64748B" }}>
          Carregando...
        </div>
      </div>
    )
  }

  const StatCard = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <AppHeader />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Painel Administrativo</h1>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Gerencie usuários, planos e pagamentos</p>
          </div>
          <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#475569" }}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, background: msg.ok ? "#F0FDF4" : "#FEF2F2", color: msg.ok ? "#15803D" : "#DC2626", border: `1px solid ${msg.ok ? "#BBF7D0" : "#FECACA"}`, fontSize: 13 }}>
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
          <StatCard label="Total usuários" value={stats.total}   icon={<Users size={17} />}    color="#1E40AF" />
          <StatCard label="Ativos"          value={stats.active} icon={<ShieldCheck size={17}/>} color="#16A34A" />
          <StatCard label="Free"            value={stats.free}   icon={<Users size={17} />}    color="#64748B" />
          <StatCard label="Premium"         value={stats.premium}icon={<Crown size={17} />}    color="#7C3AED" />
          <StatCard label="Pro"             value={stats.pro}    icon={<Crown size={17} />}    color="#B45309" />
          <StatCard label="Receita total"   value={`R$ ${stats.revenue.toFixed(2)}`} icon={<DollarSign size={17}/>} color="#F97316" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#E2E8F0", borderRadius: 8, padding: 3, marginBottom: 18, width: "fit-content" }}>
          {(["users", "payments"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              background: tab === t ? "#fff" : "transparent",
              color: tab === t ? "#1E40AF" : "#64748B",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
              {t === "users" ? <><Users size={13}/> Usuários</> : <><BarChart2 size={13}/> Todos os Pagamentos</>}
            </button>
          ))}
        </div>

        {/* ── ABA USUÁRIOS ── */}
        {tab === "users" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email..."
                style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none" }} />
              {["all","free","premium","pro"].map(p => (
                <button key={p} onClick={() => setPlanFilter(p)} style={{
                  padding: "7px 14px", borderRadius: 8, border: `1px solid ${planFilter===p ? "#1E40AF" : "#E2E8F0"}`,
                  background: planFilter===p ? "#EFF6FF" : "#fff", color: planFilter===p ? "#1E40AF" : "#64748B",
                  fontSize: 13, fontWeight: planFilter===p ? 600 : 400, cursor: "pointer",
                }}>
                  {p === "all" ? "Todos" : p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    {["Usuário","Plano","Vídeos","Status","Cadastro","Ações"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filtered.length-1 ? "1px solid #F1F5F9" : "none", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#FAFAFA")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "11px 14px" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{u.name ?? "—"}</p>
                        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{u.email}</p>
                        {u.role === "admin" && <span style={{ fontSize: 9, color: "#1E40AF", fontWeight: 700, letterSpacing: "0.05em" }}>ADMIN</span>}
                      </td>
                      <td style={{ padding: "11px 14px" }}><PlanBadge plan={u.plan} /></td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#475569" }}>{u._count.videos}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: u.status === "active" ? "#16A34A" : "#DC2626" }}>
                          {u.status === "active" ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#94A3B8" }}>
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {/* Histórico de pagamentos */}
                          <button onClick={() => openDrawer(u.id)} title="Histórico de pagamentos"
                            style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", border:"1px solid #E2E8F0", borderRadius:6, background:"#fff", cursor:"pointer", color:"#1E40AF", fontSize:12, fontWeight:600 }}>
                            <Receipt size={12}/> Pagamentos
                          </button>
                          {/* Bloquear/Desbloquear */}
                          <button onClick={() => patchUser(u.id, { status: u.status==="active" ? "blocked" : "active" })}
                            title={u.status==="active" ? "Bloquear" : "Desbloquear"}
                            style={{ padding:"5px 7px", border:"1px solid #E2E8F0", borderRadius:6, background:"#fff", cursor:"pointer", color: u.status==="active" ? "#DC2626" : "#16A34A", display:"flex" }}>
                            {u.status==="active" ? <ShieldOff size={13}/> : <ShieldCheck size={13}/>}
                          </button>
                          {/* Excluir */}
                          <button onClick={() => deleteUser(u)} title="Excluir usuário"
                            style={{ padding:"5px 7px", border:"1px solid #FECACA", borderRadius:6, background:"#FFF5F5", cursor:"pointer", color:"#DC2626", display:"flex" }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:"#94A3B8", fontSize:13 }}>Nenhum usuário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── ABA TODOS OS PAGAMENTOS ── */}
        {tab === "payments" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Usuário","Plano","Valor","Método","Observação","Data"].map(h => (
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < payments.length-1 ? "1px solid #F1F5F9" : "none" }}>
                    <td style={{ padding:"11px 14px" }}>
                      <p style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{p.user?.name ?? "—"}</p>
                      <p style={{ fontSize:11, color:"#94A3B8" }}>{p.user?.email}</p>
                    </td>
                    <td style={{ padding:"11px 14px" }}><PlanBadge plan={p.plan}/></td>
                    <td style={{ padding:"11px 14px", fontSize:13, fontWeight:600, color:"#16A34A" }}>R$ {p.amount.toFixed(2)}</td>
                    <td style={{ padding:"11px 14px", fontSize:12, color:"#64748B" }}>{METHOD_LABEL[p.method] ?? p.method}</td>
                    <td style={{ padding:"11px 14px", fontSize:12, color:"#94A3B8", maxWidth:200 }}>{p.note ?? "—"}</td>
                    <td style={{ padding:"11px 14px", fontSize:12, color:"#94A3B8" }}>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:"#94A3B8", fontSize:13 }}>Nenhum pagamento ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ DRAWER: Histórico de pagamentos do usuário ══ */}
      {(drawer || drawerLoading) && (
        <>
          {/* Overlay */}
          <div onClick={() => setDrawer(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:200 }} />

          {/* Painel lateral */}
          <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(480px,100vw)", background:"#fff", zIndex:201, boxShadow:"-4px 0 32px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Header do painel */}
            <div style={{ padding:"18px 20px", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <h2 style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>
                  {drawer?.user.name ?? "Carregando..."}
                </h2>
                {drawer && <p style={{ fontSize:12, color:"#64748B", marginTop:2 }}>{drawer.user.email}</p>}
              </div>
              {drawer && <PlanBadge plan={drawer.user.plan}/>}
              <button onClick={() => setDrawer(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:4, display:"flex" }}>
                <X size={18}/>
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>

              {drawerLoading && <p style={{ textAlign:"center", color:"#94A3B8", fontSize:13, padding:40 }}>Carregando...</p>}

              {drawer && (
                <>
                  {/* Resumo do cliente */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
                    {[
                      { label:"Plano atual", value: <PlanBadge plan={drawer.user.plan}/> },
                      { label:"Vídeos",      value: drawer.user._count.videos },
                      { label:"Pagamentos",  value: drawer.payments.length },
                    ].map(c => (
                      <div key={c.label} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 12px" }}>
                        <p style={{ fontSize:11, color:"#64748B", marginBottom:5 }}>{c.label}</p>
                        <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Registrar novo pagamento ── */}
                  <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"16px", marginBottom:22 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
                      <Plus size={14} color="#1E40AF"/>
                      <p style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Registrar Pagamento</p>
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {/* Plano */}
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:"#475569", display:"block", marginBottom:5 }}>Novo plano</label>
                        <div style={{ display:"flex", gap:6 }}>
                          {["free","premium","pro"].map(p => (
                            <button key={p} onClick={() => setNewPlan(p)} style={{
                              flex:1, padding:"7px 4px", borderRadius:7, border:`2px solid ${newPlan===p ? "#1E40AF" : "#E2E8F0"}`,
                              background: newPlan===p ? "#EFF6FF" : "#fff", color: newPlan===p ? "#1E40AF" : "#64748B",
                              fontSize:12, fontWeight:600, cursor:"pointer",
                            }}>
                              {p.charAt(0).toUpperCase()+p.slice(1)}
                              {p==="premium" && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 10 / R$ 96/ano</span>}
                              {p==="pro" && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 17,90 / R$ 172/ano</span>}
                              {p==="free" && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>Grátis</span>}
                            </button>
                          ))}
                        </div>

                      {newPlan !== "free" && (
                        <div style={{ marginTop:8 }}>
                          <label style={{ fontSize:11, fontWeight:600, color:"#475569", display:"block", marginBottom:5 }}>Tipo de cobrança</label>
                          <div style={{ display:"flex", gap:6 }}>
                            {[["monthly","Mensal"],["annual","Anual (20% off)"]].map(([v,l]) => (
                              <button key={v} onClick={() => { setNewBilling(v); setNewAmount("") }} style={{
                                flex:1, padding:"7px 4px", borderRadius:7, border:`2px solid ${newBilling===v ? "#F97316" : "#E2E8F0"}`,
                                background: newBilling===v ? "#FFF7ED" : "#fff", color: newBilling===v ? "#C2410C" : "#64748B",
                                fontSize:12, fontWeight:600, cursor:"pointer",
                              }}>
                                {l}
                                {v==="monthly" && newPlan==="premium" && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 10,00</span>}
                                {v==="monthly" && newPlan==="pro"     && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 17,90</span>}
                                {v==="annual"  && newPlan==="premium" && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 96,00</span>}
                                {v==="annual"  && newPlan==="pro"     && <span style={{ display:"block", fontSize:9, fontWeight:400, color:"#94A3B8" }}>R$ 171,84</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      </div>

                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {/* Valor */}
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:"#475569", display:"block", marginBottom:5 }}>Valor (R$)</label>
                          <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                            placeholder={newPlan==="free" ? "0.00" : newPlan==="premium" ? (newBilling==="annual" ? "96.00" : "10.00") : (newBilling==="annual" ? "171.84" : "17.90")}
                            style={{ width:"100%", padding:"7px 10px", border:"1px solid #E2E8F0", borderRadius:7, fontSize:13, outline:"none", background:"#fff" }}/>
                        </div>

                        {/* Método */}
                        <div>
                          <label style={{ fontSize:11, fontWeight:600, color:"#475569", display:"block", marginBottom:5 }}>Forma de pagamento</label>
                          <select value={newMethod} onChange={e => setNewMethod(e.target.value)}
                            style={{ width:"100%", padding:"7px 10px", border:"1px solid #E2E8F0", borderRadius:7, fontSize:13, background:"#fff", outline:"none" }}>
                            <option value="pix">PIX</option>
                            <option value="card">Cartão</option>
                            <option value="boleto">Boleto</option>
                            <option value="manual">Manual</option>
                          </select>
                        </div>
                      </div>

                      {/* Observação */}
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:"#475569", display:"block", marginBottom:5 }}>Observação</label>
                        <input value={newNote} onChange={e => setNewNote(e.target.value)}
                          placeholder="Ex: PIX comprovante #123, renovação mensal..."
                          style={{ width:"100%", padding:"7px 10px", border:"1px solid #E2E8F0", borderRadius:7, fontSize:13, outline:"none" }}/>
                      </div>

                      <button onClick={registerPayment} disabled={saving}
                        style={{ padding:"9px 0", background:"#1E40AF", border:"none", borderRadius:7, color:"#fff", fontSize:13, fontWeight:600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        <CreditCard size={13}/> {saving ? "Registrando..." : "Confirmar pagamento"}
                      </button>
                    </div>
                  </div>

                  {/* ── Histórico de pagamentos do cliente ── */}
                  <div>
                    <p style={{ fontSize:12, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>
                      Histórico <span style={{ fontWeight:400 }}>({drawer.payments.length})</span>
                    </p>

                    {drawer.payments.length === 0 && (
                      <div style={{ textAlign:"center", padding:"24px 0", color:"#CBD5E1", fontSize:13 }}>
                        Nenhum pagamento registrado
                      </div>
                    )}

                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {drawer.payments.map(p => {
                        const ps = PLAN_STYLE[p.plan] ?? PLAN_STYLE.free
                        return (
                          <div key={p.id} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:9, padding:"12px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: p.note ? 6 : 0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <PlanBadge plan={p.plan}/>
                                <span style={{ fontSize:13, fontWeight:700, color:"#16A34A" }}>R$ {p.amount.toFixed(2)}</span>
                                <span style={{ fontSize:11, color:"#94A3B8", background:"#F1F5F9", padding:"2px 7px", borderRadius:20 }}>
                                  {METHOD_LABEL[p.method] ?? p.method}
                                </span>
                              </div>
                              <span style={{ fontSize:11, color:"#CBD5E1" }}>
                                {new Date(p.createdAt).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" })}
                              </span>
                            </div>
                            {p.note && (
                              <p style={{ fontSize:12, color:"#64748B", marginTop:4, paddingLeft:2 }}>💬 {p.note}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Total pago */}
                    {drawer.payments.length > 0 && (
                      <div style={{ marginTop:14, padding:"10px 14px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"#15803D", fontWeight:600 }}>Total recebido deste cliente</span>
                        <span style={{ fontSize:15, fontWeight:700, color:"#15803D" }}>
                          R$ {drawer.payments.reduce((s,p) => s+p.amount, 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
