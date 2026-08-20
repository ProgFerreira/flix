﻿"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Plus, Trash2, X, Play, Search, ChevronDown,
  Star, CheckCircle2, Upload, Download, ListVideo, RefreshCw,
  Pencil, Shuffle, BarChart2, History, LogOut, Tag,
  GripVertical, Share2, Users, FolderOpen, UserPlus,
  Crown, Eye, Edit3, Clapperboard,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { extractYouTubeId } from "@/lib/utils"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { Logo } from "@/app/components/Logo"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import Link from "next/link"
import Image from "next/image"

// ── Types ──────────────────────────────────────────────
type Category = { id: number; name: string; color: string; _count?: { videoCategories: number } }
type VideoCategory = { category: Category }
type Video = {
  id: number; url: string; videoId: string; title: string; thumbnail: string
  duration?: string | null; channelName?: string | null; watched: boolean
  favorite: boolean; notes?: string | null; createdAt: string; sortOrder: number
  videoCategories: VideoCategory[]
  permission?: string
  sharedBy?: { id: number; email: string; name?: string | null }
}
type ShareEntry = { id: number; permission: string; to: { id: number; email: string; name?: string | null } }
type CollectionMember = { userId: number; role: string; user: { id: number; email: string; name?: string | null } }
type Collection = {
  id: number; name: string; ownerId: number; myRole: string
  owner: { id: number; email: string; name?: string | null }
  members: CollectionMember[]
  _count: { videos: number }
}

// ── Schemas ────────────────────────────────────────────
const videoSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
})
const editSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
})
const categorySchema = z.object({ name: z.string().min(1, "Nome obrigatório"), color: z.string().optional() })
const playlistSchema = z.object({ url: z.string().url("URL inválida") })

type VideoForm = z.infer<typeof videoSchema>
type EditForm = z.infer<typeof editSchema>
type CategoryForm = z.infer<typeof categorySchema>
type PlaylistForm = z.infer<typeof playlistSchema>
type ActiveFilter = "all" | "unwatched" | "watched" | "favorites" | "shared" | number

const PALETTE = ["#F97316","#2563eb","#16a34a","#7c3aed","#db2777","#0891b2","#f59e0b","#65a30d"]

// ── Helpers ────────────────────────────────────────────
function parseDurationToSeconds(d: string | null | undefined): number {
  if (!d) return 0
  const ms = d.trim().match(/^(\d+)m(\d+)s$/)
  if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2])
  const p = d.split(":").map(Number)
  if (p.length === 2) return (p[0] ?? 0) * 60 + (p[1] ?? 0)
  if (p.length === 3) return (p[0] ?? 0) * 3600 + (p[1] ?? 0) * 60 + (p[2] ?? 0)
  return 0
}
function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
function avatar(user: { email: string; name?: string | null }) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

// ── Styles ─────────────────────────────────────────────
const iStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: "#fff", border: "1px solid #CBD5E1",
  borderRadius: 7, color: "#0F172A", fontSize: 14, outline: "none", fontFamily: "inherit",
}
const btnPrimary: React.CSSProperties = {
  padding: "10px 0", background: "#F97316", border: "none",
  borderRadius: 7, color: "#fff", fontSize: 14, fontWeight: 600,
  cursor: "pointer", width: "100%", fontFamily: "inherit",
}

// ── Component ──────────────────────────────────────────
export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { play: playVideo } = usePlayer()

  useEffect(() => {
    // "/" é a biblioteca pessoal (exige conta) — quem não está logado vai pro
    // catálogo público, não direto pro login, porque agora dá pra assistir o
    // conteúdo gratuito sem conta.
    if (status === "unauthenticated") router.push("/catalogo")
  }, [status, router])
  const [videos, setVideos] = useState<Video[]>([])
  const [sharedVideos, setSharedVideos] = useState<Video[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all")
  const [activeCollection, setActiveCollection] = useState<number | null>(null)
  const [collectionVideos, setCollectionVideos] = useState<Video[]>([])

  const [watchVideo, setWatchVideo] = useState<Video | null>(null)  // mantido só para compatibilidade local
  const [editVideo, setEditVideo] = useState<Video | null>(null)
  const [shareVideo, setShareVideo] = useState<Video | null>(null)
  const [shareEntries, setShareEntries] = useState<ShareEntry[]>([])
  const [shareEmail, setShareEmail] = useState("")
  const [sharePermission, setSharePermission] = useState<"view" | "edit">("view")
  const [shareMsg, setShareMsg] = useState("")

  const [showAddVideo, setShowAddVideo] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [categoryMsg, setCategoryMsg] = useState("")
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [manageCollection, setManageCollection] = useState<Collection | null>(null)
  const [addToCollection, setAddToCollection] = useState<Video | null>(null)

  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(PALETTE[0])
  const [order, setOrder] = useState("newest")
  const [importLoading, setImportLoading] = useState(false)
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [playlistMsg, setPlaylistMsg] = useState("")
  const [gridFading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer")
  const [inviteMsg, setInviteMsg] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const videoForm = useForm<VideoForm>({ resolver: zodResolver(videoSchema), defaultValues: { categoryIds: [] } })
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues: { categoryIds: [] } })
  const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const playlistForm = useForm<PlaylistForm>({ resolver: zodResolver(playlistSchema) })

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams()
    if (typeof activeFilter === "number") p.set("categoryId", String(activeFilter))
    if (activeFilter === "watched") p.set("status", "watched")
    if (activeFilter === "unwatched") p.set("status", "unwatched")
    if (activeFilter === "favorites") p.set("status", "favorites")
    p.set("order", order)
    return p.toString()
  }, [activeFilter, order])

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, cRes, colRes, sharedRes] = await Promise.all([
        fetch(`/api/videos?${buildQuery()}`),
        fetch("/api/categories"),
        fetch("/api/collections"),
        fetch("/api/shared"),
      ])
      const [v, c, col, sh] = await Promise.all([vRes.json(), cRes.json(), colRes.json(), sharedRes.json()])
      setVideos(Array.isArray(v) ? v : [])
      setCategories(Array.isArray(c) ? c : [])
      setCollections(Array.isArray(col) ? col : [])
      setSharedVideos(Array.isArray(sh) ? sh : [])
    } catch { setTimeout(fetchAll, 1500) }
    finally { setLoading(false) }
  }, [buildQuery])

  useEffect(() => { fetchAll() }, [fetchAll, refreshKey])

  useEffect(() => {
    if (activeCollection === null) return
    fetch(`/api/collections/${activeCollection}/videos`)
      .then(r => r.json()).then(v => setCollectionVideos(Array.isArray(v) ? v : []))
  }, [activeCollection])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName.toLowerCase()
      if (t === "input" || t === "textarea" || t === "select") return
      if (e.key === "a" || e.key === "A") setShowAddVideo(true)
      if (e.key === "c" || e.key === "C") setShowAddCategory(true)
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  const changeFilter = (f: ActiveFilter) => {
    setActiveCollection(null)
    setVideos([])
    setActiveFilter(f)
  }

  const openCollection = (id: number) => {
    setActiveCollection(id)
    setActiveFilter("all")
  }

  // ── Video handlers ──────────────────────────────────
  const onVideoUrlChange = async (url: string) => {
    const id = extractYouTubeId(url)
    setUrlPreview(id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null)
    if (!id) return
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      if (res.ok) {
        const d = await res.json()
        if (d.title) videoForm.setValue("title", d.title)
        if (d.author_name) videoForm.setValue("channelName", d.author_name)
      }
    } catch {}
  }

  const onAddVideo = async (data: VideoForm) => {
    const res = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    if (res.ok) { videoForm.reset({ categoryIds: [] }); setUrlPreview(null); setShowAddVideo(false); fetchAll() }
  }

  const onEditVideo = async (data: EditForm) => {
    if (!editVideo) return
    const res = await fetch(`/api/videos/${editVideo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    if (res.ok) { setEditVideo(null); fetchAll() }
  }

  const deleteVideo = async (id: number) => {
    await fetch(`/api/videos/${id}`, { method: "DELETE" })
    setVideos(v => v.filter(x => x.id !== id))
  }

  const toggleWatched = async (video: Video) => {
    const res = await fetch(`/api/videos/${video.id}/watched`, { method: "PATCH" })
    if (res.ok) { const d = await res.json(); setVideos(v => v.map(x => x.id === video.id ? { ...x, watched: d.watched } : x)) }
  }

  const toggleFavorite = async (video: Video) => {
    const res = await fetch(`/api/videos/${video.id}/favorite`, { method: "PATCH" })
    if (res.ok) { const d = await res.json(); setVideos(v => v.map(x => x.id === video.id ? { ...x, favorite: d.favorite } : x)) }
  }

  const openEdit = (video: Video) => {
    setEditVideo(video)
    editForm.reset({ title: video.title, channelName: video.channelName ?? "", duration: video.duration ?? "", notes: video.notes ?? "", categoryIds: video.videoCategories.map(vc => vc.category.id) })
  }

  const onAddCategory = async (data: CategoryForm) => {
    setCategoryMsg("")
    const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, color: selectedColor }) })
    if (res.ok) { categoryForm.reset(); setShowAddCategory(false); fetchAll() }
    else { const d = await res.json().catch(() => null); setCategoryMsg(d?.error ?? "Erro ao criar categoria") }
  }

  const deleteCategory = async (id: number) => {
    await fetch(`/api/categories/${id}`, { method: "DELETE" })
    if (activeFilter === id) setActiveFilter("all")
    fetchAll()
  }

  const renameCategory = async (id: number, name: string, color: string) => {
    await fetch(`/api/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) })
    fetchAll()
  }

  const onImportPlaylist = async (data: PlaylistForm) => {
    setPlaylistLoading(true); setPlaylistMsg("")
    const res = await fetch("/api/playlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data.url }) })
    const json = await res.json(); setPlaylistLoading(false)
    setPlaylistMsg(res.ok ? `${json.imported} vídeo(s) importado(s)!` : (json.error ?? "Erro ao importar"))
    if (res.ok) fetchAll()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImportLoading(true)
    const json = JSON.parse(await file.text())
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) })
    setImportLoading(false)
    if (res.ok) { const d = await res.json(); alert(`Importado: ${d.imported} vídeo(s)`); fetchAll() }
    setShowImport(false); e.target.value = ""
  }

  const handleRandomVideo = async () => {
    const res = await fetch("/api/videos/random")
    if (res.ok) setWatchVideo(await res.json())
    else alert("Nenhum vídeo não assistido disponível")
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const reordered = Array.from(filtered)
    const [removed] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, removed)
    setVideos(prev => { const ids = new Set(reordered.map(v => v.id)); return [...reordered, ...prev.filter(v => !ids.has(v.id))] })
    await Promise.all(reordered.map((v, i) => fetch(`/api/videos/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })))
  }

  // ── Share handlers ──────────────────────────────────
  const openShare = async (video: Video) => {
    setShareVideo(video); setShareMsg(""); setShareEmail(""); setSharePermission("view")
    const res = await fetch(`/api/videos/${video.id}/share`)
    if (res.ok) setShareEntries(await res.json())
  }

  const doShare = async () => {
    if (!shareVideo || !shareEmail.trim()) return
    setShareMsg("")
    const res = await fetch(`/api/videos/${shareVideo.id}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail.trim(), permission: sharePermission }),
    })
    const d = await res.json()
    if (res.ok) {
      setShareEntries(prev => [...prev.filter(e => e.to.id !== d.to.id), d])
      setShareEmail(""); setShareMsg("Compartilhado com sucesso!")
    } else { setShareMsg(d.error ?? "Erro ao compartilhar") }
  }

  const revokeShare = async (toUserId: number) => {
    if (!shareVideo) return
    await fetch(`/api/videos/${shareVideo.id}/share?userId=${toUserId}`, { method: "DELETE" })
    setShareEntries(prev => prev.filter(e => e.to.id !== toUserId))
  }

  // ── Collection handlers ─────────────────────────────
  const createCollection = async () => {
    if (!newCollectionName.trim()) return
    const res = await fetch("/api/collections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCollectionName.trim() }),
    })
    if (res.ok) { setNewCollectionName(""); setShowNewCollection(false); fetchAll() }
  }

  const deleteCollection = async (id: number) => {
    await fetch(`/api/collections/${id}`, { method: "DELETE" })
    if (activeCollection === id) setActiveCollection(null)
    fetchAll()
  }

  const doInvite = async () => {
    if (!manageCollection || !inviteEmail.trim()) return
    setInviteMsg("")
    const res = await fetch(`/api/collections/${manageCollection.id}/invite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const d = await res.json()
    if (res.ok) {
      setInviteEmail(""); setInviteMsg("Membro adicionado!")
      fetchAll()
      setManageCollection(prev => prev ? { ...prev, members: [...prev.members.filter(m => m.userId !== d.userId), d] } : null)
    } else { setInviteMsg(d.error ?? "Erro ao convidar") }
  }

  const removeMember = async (userId: number) => {
    if (!manageCollection) return
    await fetch(`/api/collections/${manageCollection.id}/invite?userId=${userId}`, { method: "DELETE" })
    setManageCollection(prev => prev ? { ...prev, members: prev.members.filter(m => m.userId !== userId) } : null)
    fetchAll()
  }

  const addVideoToCollection = async (collectionId: number, videoId: number) => {
    await fetch(`/api/collections/${collectionId}/videos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    })
    if (activeCollection === collectionId) {
      setCollectionVideos(prev => prev.some(v => v.id === videoId) ? prev : [...prev, videos.find(v => v.id === videoId)!])
    }
    setAddToCollection(null)
  }

  const removeVideoFromCollection = async (videoId: number) => {
    if (!activeCollection) return
    await fetch(`/api/collections/${activeCollection}/videos?videoId=${videoId}`, { method: "DELETE" })
    setCollectionVideos(prev => prev.filter(v => v.id !== videoId))
  }

  // ── Derived data ────────────────────────────────────
  const displayVideos: Video[] = activeCollection !== null
    ? collectionVideos
    : activeFilter === "shared"
    ? sharedVideos
    : videos

  const filtered = displayVideos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    (v.channelName ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const totalSecs = filtered.reduce((a, v) => a + parseDurationToSeconds(v.duration), 0)
  const watchedCount = videos.filter(v => v.watched).length
  const currentCollection = activeCollection !== null ? collections.find(c => c.id === activeCollection) : null

  if (status === "loading" || status === "unauthenticated") {
    return <div style={{ minHeight: "100vh", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 14, color: "#94A3B8" }}>Carregando...</span>
    </div>
  }

  return (
    <div style={{ background: "#F1F5F9", minHeight: "100vh" }}>

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px", height: 58, display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={22} />

          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vídeos..."
              style={{ ...iStyle, padding: undefined, paddingTop: 9, paddingBottom: 9, paddingLeft: 32, paddingRight: search ? 30 : 12, fontSize: 13 }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}><X size={13} /></button>}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {session?.user?.name && <span style={{ fontSize: 13, color: "#64748B", marginRight: 4 }}>Olá, {session.user.name.split(" ")[0]}</span>}
            <Link href="/catalogo" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, color: "#64748B", textDecoration: "none", fontSize: 13, border: "1px solid transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#0F172A" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#64748B" }}>
              <Clapperboard size={14} /> Catálogo
            </Link>
            <Link href="/historico" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, color: "#64748B", textDecoration: "none", fontSize: 13, border: "1px solid transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#0F172A" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#64748B" }}>
              <History size={14} /> Histórico
            </Link>
            <Link href="/estatisticas" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, color: "#64748B", textDecoration: "none", fontSize: 13, border: "1px solid transparent" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#0F172A" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#64748B" }}>
              <BarChart2 size={14} /> Stats
            </Link>
            <button onClick={handleRandomVideo} title="Vídeo aleatório" style={{ display: "flex", padding: "6px 8px", borderRadius: 6, background: "none", border: "1px solid transparent", cursor: "pointer", color: "#64748B" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#0F172A" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#64748B" }}>
              <Shuffle size={14} />
            </button>
            <button onClick={() => setShowImport(true)} title="Importar JSON" style={{ display: "flex", padding: "6px 8px", background: "none", border: "1px solid transparent", cursor: "pointer", color: "#64748B", borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#E2E8F0"} onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
              <Upload size={14} />
            </button>
            <button onClick={() => window.open("/api/export", "_blank")} title="Exportar JSON" style={{ display: "flex", padding: "6px 8px", background: "none", border: "1px solid transparent", cursor: "pointer", color: "#64748B", borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#E2E8F0"} onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
              <Download size={14} />
            </button>
            <button onClick={() => setShowPlaylist(true)} title="Importar Playlist" style={{ display: "flex", padding: "6px 8px", background: "none", border: "1px solid transparent", cursor: "pointer", color: "#64748B", borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#E2E8F0"} onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
              <ListVideo size={14} />
            </button>
            <button onClick={() => setShowAddCategory(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid #E2E8F0", cursor: "pointer", color: "#475569", fontSize: 13 }}>
              <Tag size={13} /> Categoria
            </button>
            <button onClick={() => setShowAddVideo(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 6, background: "#F97316", border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> Adicionar
            </button>
            <button onClick={() => { setRefreshing(true); setRefreshKey(k => k + 1); setTimeout(() => setRefreshing(false), 800) }} title="Atualizar" style={{ display: "flex", padding: "6px 8px", background: "none", border: "1px solid transparent", cursor: "pointer", color: "#64748B", borderRadius: 6, transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#E2E8F0"} onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
              <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.7s linear infinite" : "none" }} />
            </button>
            {session && <button onClick={() => signOut()} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, background: "none", border: "1px solid #E2E8F0", cursor: "pointer", color: "#64748B", fontSize: 13 }}><LogOut size={13} /> Sair</button>}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px" }}>

        {/* FILTERS */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(["all", "unwatched", "watched", "favorites"] as ActiveFilter[]).map(f => {
            const labels: Record<string, string> = { all: "Todos", unwatched: "Não assistidos", watched: "Assistidos", favorites: "Favoritos" }
            const active = activeFilter === f && activeCollection === null
            return (
              <button key={f} onClick={() => changeFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${active ? "#F97316" : "#E2E8F0"}`, background: active ? "#F97316" : "transparent", color: active ? "#fff" : "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
                {labels[f as string]}
              </button>
            )
          })}

          <button onClick={() => changeFilter("shared")} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${activeFilter === "shared" && activeCollection === null ? "#2563eb" : "#E2E8F0"}`, background: activeFilter === "shared" && activeCollection === null ? "#2563eb" : "transparent", color: activeFilter === "shared" && activeCollection === null ? "#fff" : "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}>
            <Share2 size={11} /> Comigo {sharedVideos.length > 0 && `(${sharedVideos.length})`}
          </button>

          {categories.map(cat => (
            <CategoryFilterBtn key={cat.id} cat={cat} active={activeFilter === cat.id && activeCollection === null}
              onClick={() => changeFilter(cat.id)}
              onDelete={() => deleteCategory(cat.id)}
              onRename={(n, c) => renameCategory(cat.id, n, c)} />
          ))}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {totalSecs > 0 && <span style={{ fontSize: 12, color: "#94A3B8" }}>⏱ {formatDuration(totalSecs)}</span>}
            {videos.length > 0 && <span style={{ fontSize: 12, color: "#94A3B8" }}>{watchedCount}/{videos.length} assistidos</span>}
            <div style={{ position: "relative" }}>
              <select value={order} onChange={e => setOrder(e.target.value)} style={{ ...iStyle, fontSize: 12, padding: "5px 28px 5px 10px", appearance: "none", width: "auto" }}>
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="az">A → Z</option>
                <option value="favorites">Favoritos</option>
                <option value="manual">Manual</option>
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {/* COLLECTIONS ROW */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <FolderOpen size={14} color="#64748B" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Coleções</span>
            <button onClick={() => setShowNewCollection(true)} style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", padding: "4px 10px", borderRadius: 6, background: "none", border: "1px solid #E2E8F0", cursor: "pointer", color: "#64748B", fontSize: 12 }}>
              <Plus size={11} /> Nova
            </button>
          </div>
          {collections.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma coleção ainda. Crie uma para agrupar e compartilhar vídeos com outros usuários.</p>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {collections.map(col => (
                <CollectionChip key={col.id} col={col} active={activeCollection === col.id}
                  onClick={() => openCollection(col.id)}
                  onManage={() => { setManageCollection(col); setInviteMsg(""); setInviteEmail("") }}
                  onDelete={() => deleteCollection(col.id)} />
              ))}
            </div>
          )}
        </div>

        {/* GRID HEADER */}
        {currentCollection && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setActiveCollection(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}><X size={14} /></button>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{currentCollection.name}</h2>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>{collectionVideos.length} vídeo(s)</span>
            <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
              {currentCollection.members.slice(0, 4).map(m => (
                <div key={m.userId} title={m.user.name ?? m.user.email} style={{ width: 24, height: 24, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                  {avatar(m.user)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRID */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ borderRadius: 10, height: 190 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94A3B8" }}>
            <Play size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#64748B" }}>
              {activeCollection !== null ? "Nenhum vídeo nesta coleção" : "Nenhum vídeo encontrado"}
            </p>
            <p style={{ fontSize: 13 }}>
              {activeCollection !== null ? "Adicione vídeos usando o botão 📁 nos cards" : "Adicione um vídeo para começar"}
            </p>
          </div>
        ) : order === "manual" && activeCollection === null ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="videos" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={gridFading ? "fading" : ""}
                  style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  {filtered.map((video, i) => (
                    <Draggable key={video.id} draggableId={String(video.id)} index={i}>
                      {(dp) => (
                        <div ref={dp.innerRef} {...dp.draggableProps}>
                          <VideoCard video={video} index={i} dragHandle={dp.dragHandleProps}
                            onWatch={() => playVideo(video)} onDelete={() => deleteVideo(video.id)}
                            onEdit={() => openEdit(video)} onToggleWatched={() => toggleWatched(video)}
                            onToggleFavorite={() => toggleFavorite(video)} onShare={() => openShare(video)}
                            onAddToCollection={() => setAddToCollection(video)}
                            inCollection={false} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className={gridFading ? "fading" : ""} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {filtered.map((video, i) => (
              <VideoCard key={video.id} video={video} index={i}
                onWatch={() => playVideo(video)}
                onDelete={activeCollection !== null ? () => removeVideoFromCollection(video.id) : () => deleteVideo(video.id)}
                onEdit={activeCollection !== null ? undefined : () => openEdit(video)}
                onToggleWatched={() => toggleWatched(video)}
                onToggleFavorite={() => toggleFavorite(video)}
                onShare={activeFilter !== "shared" && activeCollection === null ? () => openShare(video) : undefined}
                onAddToCollection={activeCollection === null && activeFilter !== "shared" ? () => setAddToCollection(video) : undefined}
                inCollection={activeCollection !== null}
                sharedBy={video.sharedBy} />
            ))}
          </div>
        )}
      </div>

      {/* Player global — gerenciado pelo PlayerContext em providers.tsx */}

      {/* MODAL: Add Video */}
      {showAddVideo && (
        <Modal onClose={() => { setShowAddVideo(false); videoForm.reset({ categoryIds: [] }); setUrlPreview(null) }}>
          <div style={{ width: "min(440px, 92vw)" }}>
            <ModalHeader title="Adicionar Vídeo" onClose={() => { setShowAddVideo(false); videoForm.reset({ categoryIds: [] }); setUrlPreview(null) }} />
            <form onSubmit={videoForm.handleSubmit(onAddVideo)} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="URL do YouTube" error={videoForm.formState.errors.url?.message}>
                <input {...videoForm.register("url", { onChange: e => onVideoUrlChange(e.target.value) })} placeholder="https://youtube.com/watch?v=..." style={iStyle} />
              </Field>
              {urlPreview && (
                <div style={{ position: "relative", width: "100%", height: 110, borderRadius: 6, overflow: "hidden" }}>
                  <Image src={urlPreview} alt="" fill sizes="440px" style={{ objectFit: "cover" }} />
                </div>
              )}
              <Field label="Título" error={videoForm.formState.errors.title?.message}>
                <input {...videoForm.register("title")} placeholder="Nome do vídeo" style={iStyle} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Canal"><input {...videoForm.register("channelName")} placeholder="Canal" style={iStyle} /></Field>
                <Field label="Duração"><input {...videoForm.register("duration")} placeholder="5:32" style={iStyle} /></Field>
              </div>
              <Field label="Notas"><textarea {...videoForm.register("notes")} placeholder="Anotações..." rows={2} style={{ ...iStyle, resize: "vertical" }} /></Field>
              <Field label="Categorias">
                <CategoryPicker categories={categories} selected={videoForm.watch("categoryIds") ?? []} onChange={ids => videoForm.setValue("categoryIds", ids)} />
              </Field>
              <button type="submit" style={btnPrimary}>Salvar Vídeo</button>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL: Edit Video */}
      {editVideo && (
        <Modal onClose={() => setEditVideo(null)}>
          <div style={{ width: "min(440px, 92vw)" }}>
            <ModalHeader title="Editar Vídeo" onClose={() => setEditVideo(null)} />
            <form onSubmit={editForm.handleSubmit(onEditVideo)} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="Título" error={editForm.formState.errors.title?.message}>
                <input {...editForm.register("title")} style={iStyle} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Canal"><input {...editForm.register("channelName")} style={iStyle} /></Field>
                <Field label="Duração"><input {...editForm.register("duration")} style={iStyle} /></Field>
              </div>
              <Field label="Notas"><textarea {...editForm.register("notes")} rows={3} style={{ ...iStyle, resize: "vertical" }} /></Field>
              <Field label="Categorias">
                <CategoryPicker categories={categories} selected={editForm.watch("categoryIds") ?? []} onChange={ids => editForm.setValue("categoryIds", ids)} />
              </Field>
              <button type="submit" style={btnPrimary}>Salvar Alterações</button>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL: Share Video */}
      {shareVideo && (
        <Modal onClose={() => { setShareVideo(null); setShareEntries([]) }}>
          <div style={{ width: "min(420px, 92vw)" }}>
            <ModalHeader title="Compartilhar Vídeo" onClose={() => { setShareVideo(null); setShareEntries([]) }} />
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>{shareVideo.title}</p>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="email@usuario.com"
                style={{ ...iStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && doShare()} />
              <div style={{ position: "relative" }}>
                <select value={sharePermission} onChange={e => setSharePermission(e.target.value as "view" | "edit")}
                  style={{ ...iStyle, width: "auto", paddingRight: 28, appearance: "none", cursor: "pointer" }}>
                  <option value="view">Ver</option>
                  <option value="edit">Editar</option>
                </select>
                <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
              </div>
              <button onClick={doShare} style={{ padding: "9px 14px", background: "#F97316", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Convidar
              </button>
            </div>

            {shareMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 7, marginBottom: 8, background: shareMsg.includes("sucesso") ? "#f0fdf4" : "#fef2f2", border: `1px solid ${shareMsg.includes("sucesso") ? "#bbf7d0" : "#fecaca"}`, fontSize: 13, color: shareMsg.includes("sucesso") ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                {shareMsg}
              </div>
            )}

            {shareEntries.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Com acesso</p>
                {shareEntries.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#475569" }}>
                      {avatar(e.to)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.to.name ?? e.to.email}</p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>{e.to.email}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: e.permission === "edit" ? "#fef3c7" : "#f0f9ff", color: e.permission === "edit" ? "#92400e" : "#0369a1" }}>
                      {e.permission === "edit" ? "Editor" : "Visualizador"}
                    </span>
                    <button onClick={() => revokeShare(e.to.id)} title="Remover acesso" style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: Add Category */}
      {showAddCategory && (
        <Modal onClose={() => { setShowAddCategory(false); categoryForm.reset(); setCategoryMsg("") }}>
          <div style={{ width: "min(340px, 92vw)" }}>
            <ModalHeader title="Nova Categoria" onClose={() => { setShowAddCategory(false); categoryForm.reset(); setCategoryMsg("") }} />
            <form onSubmit={categoryForm.handleSubmit(onAddCategory)} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="Nome" error={categoryForm.formState.errors.name?.message}>
                <input {...categoryForm.register("name")} placeholder="Ex: Música, Tutoriais..." style={iStyle} />
              </Field>
              <Field label="Cor">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PALETTE.map(c => (
                    <button key={c} type="button" onClick={() => setSelectedColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer", transition: "all 0.15s", boxShadow: selectedColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none", transform: selectedColor === c ? "scale(1.2)" : "scale(1)" }} />
                  ))}
                </div>
              </Field>
              {categoryMsg && <p style={{ fontSize: 13, color: "#dc2626" }}>{categoryMsg}</p>}
              <button type="submit" style={btnPrimary}>Criar Categoria</button>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL: Playlist */}
      {showPlaylist && (
        <Modal onClose={() => { setShowPlaylist(false); playlistForm.reset(); setPlaylistMsg("") }}>
          <div style={{ width: "min(400px, 92vw)" }}>
            <ModalHeader title="Importar Playlist" onClose={() => { setShowPlaylist(false); playlistForm.reset(); setPlaylistMsg("") }} />
            <form onSubmit={playlistForm.handleSubmit(onImportPlaylist)} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="URL da Playlist do YouTube">
                <input {...playlistForm.register("url")} placeholder="https://youtube.com/playlist?list=..." style={iStyle} />
              </Field>
              {playlistMsg && <p style={{ fontSize: 13, color: playlistMsg.includes("importado") ? "#16a34a" : "#dc2626" }}>{playlistMsg}</p>}
              <button type="submit" style={btnPrimary} disabled={playlistLoading}>{playlistLoading ? "Importando..." : "Importar"}</button>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL: Import JSON */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <div style={{ width: "min(340px, 92vw)" }}>
            <ModalHeader title="Importar JSON" onClose={() => setShowImport(false)} />
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Selecione um arquivo JSON exportado anteriormente.</p>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} style={btnPrimary} disabled={importLoading}>
              {importLoading ? "Importando..." : "Selecionar arquivo"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: New Collection */}
      {showNewCollection && (
        <Modal onClose={() => { setShowNewCollection(false); setNewCollectionName("") }}>
          <div style={{ width: "min(360px, 92vw)" }}>
            <ModalHeader title="Nova Coleção" onClose={() => { setShowNewCollection(false); setNewCollectionName("") }} />
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Crie uma coleção para agrupar vídeos e compartilhar com outros usuários.</p>
            <Field label="Nome da coleção">
              <input value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)}
                placeholder="Ex: Favoritos da turma, Estudos..." style={iStyle}
                onKeyDown={e => e.key === "Enter" && createCollection()} autoFocus />
            </Field>
            <button onClick={createCollection} style={{ ...btnPrimary, marginTop: 16 }}>Criar Coleção</button>
          </div>
        </Modal>
      )}

      {/* MODAL: Manage Collection */}
      {manageCollection && (
        <Modal onClose={() => { setManageCollection(null); setInviteMsg("") }}>
          <div style={{ width: "min(480px, 92vw)" }}>
            <ModalHeader title={manageCollection.name} onClose={() => { setManageCollection(null); setInviteMsg("") }} />

            {(manageCollection.myRole === "owner" || manageCollection.myRole === "editor") && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Convidar membro</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@usuario.com"
                    style={{ ...iStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && doInvite()} />
                  <div style={{ position: "relative" }}>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value as "viewer" | "editor")}
                      style={{ ...iStyle, width: "auto", paddingRight: 28, appearance: "none" }}>
                      <option value="viewer">Visualizador</option>
                      <option value="editor">Editor</option>
                    </select>
                    <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                  </div>
                  <button onClick={doInvite} style={{ padding: "9px 14px", background: "#F97316", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <UserPlus size={14} />
                  </button>
                </div>
                {inviteMsg && <p style={{ fontSize: 12, marginBottom: 12, color: inviteMsg.includes("adicionado") ? "#16a34a" : "#dc2626" }}>{inviteMsg}</p>}
              </>
            )}

            <p style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, marginTop: 16 }}>Membros ({manageCollection.members.length})</p>
            {manageCollection.members.map(m => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.role === "owner" ? "#F97316" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: m.role === "owner" ? "#fff" : "#475569" }}>
                  {avatar(m.user)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.user.name ?? m.user.email}</p>
                  <p style={{ fontSize: 11, color: "#94A3B8" }}>{m.user.email}</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 10, background: m.role === "owner" ? "#fff7ed" : m.role === "editor" ? "#fef3c7" : "#f0f9ff", color: m.role === "owner" ? "#c2410c" : m.role === "editor" ? "#92400e" : "#0369a1" }}>
                  {m.role === "owner" ? <><Crown size={9} /> Dono</> : m.role === "editor" ? <><Edit3 size={9} /> Editor</> : <><Eye size={9} /> Visualizador</>}
                </span>
                {manageCollection.myRole === "owner" && m.role !== "owner" && (
                  <button onClick={() => removeMember(m.userId)} title="Remover" style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}><X size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* MODAL: Add to Collection */}
      {addToCollection && (
        <Modal onClose={() => setAddToCollection(null)}>
          <div style={{ width: "min(360px, 92vw)" }}>
            <ModalHeader title="Adicionar à Coleção" onClose={() => setAddToCollection(null)} />
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>{addToCollection.title}</p>
            {collections.filter(c => c.myRole !== "viewer").length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8" }}>Você não tem coleções onde pode adicionar vídeos.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {collections.filter(c => c.myRole !== "viewer").map(col => (
                  <button key={col.id} onClick={() => addVideoToCollection(col.id, addToCollection.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f9f9f9", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
                    <FolderOpen size={16} color="#F97316" />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{col.name}</p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>{col._count.videos} vídeo(s) · {col.members.length} membro(s)</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────
function CollectionChip({ col, active, onClick, onManage, onDelete }: {
  col: Collection; active: boolean; onClick: () => void; onManage: () => void; onDelete: () => void
}) {
  const [hover, setHover] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDelConfirm(false) }}>
      <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? "#F97316" : "#E2E8F0"}`, background: active ? "#F97316" : "#fff", color: active ? "#fff" : "#475569", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
        <FolderOpen size={12} />
        {col.name}
        <span style={{ fontSize: 11, opacity: 0.75 }}>{col._count.videos}</span>
        <div style={{ display: "flex" }}>
          {col.members.slice(0, 3).map((m, i) => (
            <div key={m.userId} title={m.user.name ?? m.user.email} style={{ width: 16, height: 16, borderRadius: "50%", background: active ? "rgba(255,255,255,0.4)" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: active ? "#fff" : "#475569", marginLeft: i > 0 ? -4 : 0, border: "1px solid #fff" }}>
              {avatar(m.user)}
            </div>
          ))}
        </div>
      </button>
      {hover && <>
        <button onClick={onManage} title="Gerenciar" style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 3 }}><Users size={11} /></button>
        {col.myRole === "owner" && !delConfirm && <button onClick={() => setDelConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 3 }}><X size={11} /></button>}
        {col.myRole === "owner" && delConfirm && <>
          <button onClick={onDelete} style={{ fontSize: 11, padding: "2px 7px", background: "#dc2626", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>Sim</button>
          <button onClick={() => setDelConfirm(false)} style={{ fontSize: 11, padding: "2px 7px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 4, color: "#64748B", cursor: "pointer" }}>Não</button>
        </>}
      </>}
    </div>
  )
}

function CategoryFilterBtn({ cat, active, onClick, onDelete, onRename }: {
  cat: Category; active: boolean; onClick: () => void; onDelete: () => void; onRename: (n: string, c: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(cat.name)
  const [editColor, setEditColor] = useState(cat.color)
  const [delConfirm, setDelConfirm] = useState(false)

  if (editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f9f9f9", border: "1px solid #E2E8F0", borderRadius: 20, padding: "4px 10px" }}>
      {PALETTE.map(c => <button key={c} type="button" onClick={() => setEditColor(c)} style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "none", cursor: "pointer", boxShadow: editColor === c ? `0 0 0 2px #fff, 0 0 0 3px ${c}` : "none" }} />)}
      <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && editName.trim()) { onRename(editName.trim(), editColor); setEditing(false) } if (e.key === "Escape") setEditing(false) }} autoFocus style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", width: 80 }} />
      <button onClick={() => { if (editName.trim()) { onRename(editName.trim(), editColor); setEditing(false) } }} style={{ background: "#F97316", border: "none", borderRadius: 4, color: "#fff", fontSize: 11, padding: "2px 7px", cursor: "pointer" }}>OK</button>
      <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={11} /></button>
    </div>
  )

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDelConfirm(false) }}>
      <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? cat.color : "#E2E8F0"}`, background: active ? cat.color : "transparent", color: active ? "#fff" : "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : cat.color, flexShrink: 0 }} />
        {cat.name}
        <span style={{ fontSize: 11, opacity: 0.7 }}>{cat._count?.videoCategories ?? 0}</span>
      </button>
      {hover && !delConfirm && <>
        <button onClick={() => { setEditing(true); setEditName(cat.name); setEditColor(cat.color) }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 2 }}><Pencil size={11} /></button>
        <button onClick={() => setDelConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex", padding: 2 }}><X size={11} /></button>
      </>}
      {hover && delConfirm && <div style={{ display: "flex", gap: 4 }}>
        <button onClick={onDelete} style={{ fontSize: 11, padding: "2px 7px", background: "#dc2626", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>Sim</button>
        <button onClick={() => setDelConfirm(false)} style={{ fontSize: 11, padding: "2px 7px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 4, color: "#64748B", cursor: "pointer" }}>Não</button>
      </div>}
    </div>
  )
}

function VideoCard({ video, index, dragHandle, onWatch, onDelete, onEdit, onToggleWatched, onToggleFavorite, onShare, onAddToCollection, inCollection, sharedBy }: {
  video: Video; index: number; dragHandle?: React.HTMLAttributes<HTMLElement> | null
  onWatch: () => void; onDelete: () => void; onEdit?: () => void
  onToggleWatched: () => void; onToggleFavorite: () => void
  onShare?: () => void; onAddToCollection?: () => void
  inCollection: boolean; sharedBy?: { id: number; email: string; name?: string | null }
}) {
  const [hover, setHover] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const cats = video.videoCategories.map(vc => vc.category)

  return (
    <div className="animate-fade-up" style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, animationFillMode: "both" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDelConfirm(false) }}>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0", background: "#fff", boxShadow: hover ? "0 4px 16px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s, transform 0.2s", transform: hover ? "translateY(-2px)" : "translateY(0)", opacity: video.watched ? 0.7 : 1 }}>

        {/* Thumbnail */}
        <div style={{ position: "relative", paddingBottom: "56.25%", cursor: "pointer", background: "#E2E8F0" }} onClick={onWatch}>
          <Image src={video.thumbnail} alt={video.title} fill sizes="(max-width: 640px) 50vw, 220px" style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: hover ? 1 : 0, transition: "opacity 0.2s" }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Play size={18} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
            </div>
          </div>
          {video.duration && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4 }}>{video.duration}</span>}
          {video.watched && <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(22,163,74,0.9)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={9} /> Assistido</span>}
          {video.favorite && !video.watched && <span style={{ position: "absolute", top: 6, left: 6, color: "#f59e0b", fontSize: 16 }}>⭐</span>}
          {dragHandle && <span {...dragHandle} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: 3, cursor: "grab", display: "flex" }}><GripVertical size={12} color="#fff" /></span>}
        </div>

        {/* Info */}
        <div style={{ padding: "10px 11px" }}>
          {sharedBy && <p style={{ fontSize: 10, color: "#2563eb", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}><Share2 size={9} /> {sharedBy.name ?? sharedBy.email}</p>}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: 1.4, marginBottom: 5 }} title={video.title}>
            {video.title.length > 58 ? video.title.slice(0, 58) + "..." : video.title}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {video.channelName && <span style={{ fontSize: 11, color: "#94A3B8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.channelName}</span>}
            {cats.slice(0, 1).map(c => <span key={c.id} style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10, background: c.color + "20", color: c.color, flexShrink: 0 }}>{c.name}</span>)}
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 8, justifyContent: "flex-end", opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
            <ActionBtn onClick={onToggleFavorite} title="Favorito" active={video.favorite} activeColor="#f59e0b"><Star size={13} fill={video.favorite ? "#f59e0b" : "none"} /></ActionBtn>
            <ActionBtn onClick={onToggleWatched} title="Assistido" active={video.watched} activeColor="#16a34a"><CheckCircle2 size={13} /></ActionBtn>
            {onEdit && <ActionBtn onClick={onEdit} title="Editar"><Pencil size={13} /></ActionBtn>}
            {onShare && <ActionBtn onClick={onShare} title="Compartilhar"><Share2 size={13} /></ActionBtn>}
            {onAddToCollection && <ActionBtn onClick={onAddToCollection} title="Adicionar à coleção"><FolderOpen size={13} /></ActionBtn>}
            {delConfirm
              ? <><button onClick={onDelete} style={{ fontSize: 11, padding: "2px 7px", background: "#dc2626", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer" }}>{inCollection ? "Remover" : "Sim"}</button>
                  <button onClick={() => setDelConfirm(false)} style={{ fontSize: 11, padding: "2px 7px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 4, color: "#64748B", cursor: "pointer" }}>Não</button></>
              : <ActionBtn onClick={() => setDelConfirm(true)} title={inCollection ? "Remover da coleção" : "Excluir"}><Trash2 size={13} /></ActionBtn>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ children, onClick, title, active, activeColor }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean; activeColor?: string }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: "none", cursor: "pointer", color: active ? activeColor : "#CBD5E1", display: "flex", padding: 4, transition: "color 0.15s" }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "#64748B" }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "#CBD5E1" }}>
      {children}
    </button>
  )
}

function CategoryPicker({ categories, selected, onChange }: { categories: Category[]; selected: number[]; onChange: (ids: number[]) => void }) {
  if (categories.length === 0) return <p style={{ fontSize: 12, color: "#94A3B8" }}>Nenhuma categoria criada.</p>
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {categories.map(c => {
        const on = selected.includes(c.id)
        return (
          <button key={c.id} type="button" onClick={() => onChange(on ? selected.filter(id => id !== c.id) : [...selected, c.id])}
            style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: `1px solid ${on ? c.color : "#E2E8F0"}`, background: on ? c.color + "18" : "transparent", color: on ? c.color : "#64748B", cursor: "pointer", transition: "all 0.15s" }}>
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div className="animate-scale-in" onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #E2E8F0", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>{title}</h2>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X size={18} /></button>
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
    </div>
  )
}

