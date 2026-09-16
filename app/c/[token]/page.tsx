"use client"

import { use } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { AppHeader, VisitorHeader } from "@/app/components/AppHeader"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { Film, Play, FolderOpen } from "lucide-react"
import type { PublicCollectionPayload } from "@/lib/collection-share"

export default function PublicCollectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { status } = useSession()
  const { play } = usePlayer()
  const isLoggedIn = status === "authenticated"

  const query = useQuery({
    queryKey: ["public-collection", token],
    queryFn: async () => {
      const res = await fetch(`/api/c/${encodeURIComponent(token)}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error("Falha ao carregar coleção")
      return res.json() as Promise<PublicCollectionPayload>
    },
  })

  const Header = isLoggedIn ? AppHeader : VisitorHeader

  if (query.isLoading || status === "loading") {
    return <div className="page"><Header /><div className="loading-center">Carregando...</div></div>
  }

  const data = query.data
  if (!data) {
    return (
      <div className="page">
        <Header />
        <main id="conteudo" className="page-wrap page-wrap--narrow">
          <div className="empty">
            <FolderOpen size={40} className="empty-icon" />
            <p>Este link não está mais ativo</p>
            <p className="page-sub">Peça um link novo a quem compartilhou, ou organize a sua própria biblioteca.</p>
            <Link href={isLoggedIn ? "/" : "/login"} className="btn btn-accent">
              {isLoggedIn ? "Ir para a biblioteca" : "Criar conta"}
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <Header />
      <main id="conteudo" className="page-wrap">
        <div className="page-lead">
          <p className="kicker kicker-inline">Coleção compartilhada</p>
          <h1 className="page-title">{data.name}</h1>
          <p className="page-sub">Curadoria de {data.ownerName} · você assiste o que alguém escolheu, não o que um algoritmo empurra.</p>
        </div>

        {data.videos.length === 0 ? (
          <div className="empty">
            <Film size={40} className="empty-icon" />
            <p>Nenhum vídeo do YouTube nesta coleção</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {data.videos.map((v) => (
              <div key={v.videoId} className="video-card animate-fade-up">
                <div
                  className="video-card-thumb"
                  role="button"
                  tabIndex={0}
                  aria-label={`Assistir ${v.title}`}
                  onClick={() => play({ id: 0, videoId: v.videoId, title: v.title, channelName: v.channelName, source: "youtube" })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      play({ id: 0, videoId: v.videoId, title: v.title, channelName: v.channelName, source: "youtube" })
                    }
                  }}
                >
                  <Image src={v.thumbnail || "/video-placeholder.svg"} alt={v.title} fill sizes="(max-width: 640px) 50vw, 220px" style={{ objectFit: "cover" }} />
                  <div className="thumb-center">
                    <div className="play-btn"><Play size={18} fill="#fff" color="#fff" /></div>
                  </div>
                  {v.duration && <span className="thumb-time">{v.duration}</span>}
                </div>
                <div className="video-card-body">
                  <h3 className="video-card-title" title={v.title}>
                    {v.title.length > 58 ? v.title.slice(0, 58) + "…" : v.title}
                  </h3>
                  {v.channelName && <p className="video-card-channel">{v.channelName}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="center-note">
          {isLoggedIn
            ? <Link href="/" className="link">Organize a sua biblioteca</Link>
            : <>Gostou da ideia? <Link href="/login" className="link">Crie uma conta</Link> e monte as suas coleções.</>}
        </p>
      </main>
    </div>
  )
}
