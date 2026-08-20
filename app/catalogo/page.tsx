"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/app/components/AppHeader"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { Lock, Play, Film, Crown } from "lucide-react"

type Category = { id: number; name: string; color: string }
type CatalogVideo = {
  id: number; title: string; thumbnail: string
  duration?: string | null; channelName?: string | null
  createdAt: string; requiredPlan: string; locked: boolean
  videoCategories: { category: Category }[]
}

const PLAN_LABEL: Record<string, string> = { free: "Free", premium: "Premium", pro: "Pro" }
const PLAN_COLOR: Record<string, string> = { free: "#64748B", premium: "#7C3AED", pro: "#B45309" }

export default function CatalogoPage() {
  const { status } = useSession()
  const router = useRouter()
  const { play } = usePlayer()

  const [videos, setVideos] = useState<CatalogVideo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/catalog")
    const data = await res.json()
    if (Array.isArray(data)) setVideos(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { router.push("/login"); return }
    fetchCatalog()
  }, [status, fetchCatalog, router])

  const watch = (v: CatalogVideo) => {
    if (v.locked) return
    play({ id: v.id, title: v.title, channelName: v.channelName, source: "upload" })
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div style={{ minHeight: "100vh", background: "#F1F5F9" }}><AppHeader /><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#64748B" }}>Carregando...</div></div>
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9" }}>
      <AppHeader />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Catálogo</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Vídeos autorais disponíveis conforme a sua assinatura</p>
        </div>

        {videos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
            <Film size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "#64748B" }}>Nenhum vídeo publicado ainda</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {videos.map((v) => (
              <div key={v.id} className="animate-fade-up" style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0", background: "#fff", opacity: v.locked ? 0.85 : 1 }}>
                <div onClick={() => watch(v)} style={{ position: "relative", paddingBottom: "56.25%", background: "#0F172A", cursor: v.locked ? "not-allowed" : "pointer" }}>
                  <img src={v.thumbnail} alt={v.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: v.locked ? "grayscale(0.5) brightness(0.5)" : "none" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: v.locked ? "rgba(0,0,0,0.25)" : "transparent" }}>
                    {v.locked ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#fff" }}>
                        <Lock size={22} />
                        <span style={{ fontSize: 11, fontWeight: 700, background: PLAN_COLOR[v.requiredPlan], padding: "2px 8px", borderRadius: 20 }}>
                          Exige {PLAN_LABEL[v.requiredPlan]}+
                        </span>
                      </div>
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Play size={18} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
                      </div>
                    )}
                  </div>
                  {v.duration && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>{v.duration}</span>}
                </div>
                <div style={{ padding: "10px 11px" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: 1.4, marginBottom: 5 }} title={v.title}>
                    {v.title.length > 58 ? v.title.slice(0, 58) + "…" : v.title}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {v.channelName && <span style={{ fontSize: 11, color: "#94A3B8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.channelName}</span>}
                    {v.videoCategories.slice(0, 1).map((vc) => (
                      <span key={vc.category.id} style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10, background: vc.category.color + "20", color: vc.category.color, flexShrink: 0 }}>{vc.category.name}</span>
                    ))}
                  </div>
                  {v.locked && (
                    <Link href="/plano" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 0", borderRadius: 6, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309", textDecoration: "none" }}>
                      <Crown size={12} /> Assinar {PLAN_LABEL[v.requiredPlan]}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
