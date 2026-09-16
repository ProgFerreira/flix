"use client"

import { useState, useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { extractYouTubeId } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePlayer } from "@/app/contexts/PlayerContext"
import { AppHeader } from "@/app/components/AppHeader"
import { useUrlState } from "@/app/hooks/useUrlState"
import { itemsFromPaginated, pageMeta } from "@/lib/pagination"
import { PALETTE, type ActiveFilter, type Category, type Collection, type ShareEntry, type Video } from "@/app/components/library/types"
import { parseDurationToSeconds } from "@/app/components/library/helpers"
import { LibraryToolbar } from "@/app/components/library/LibraryToolbar"
import { LibraryGrid } from "@/app/components/library/LibraryGrid"
import { LibraryModals } from "@/app/components/library/LibraryModals"
import { videoSchema, editSchema, categorySchema, playlistSchema, type VideoForm, type EditForm, type CategoryForm, type PlaylistForm } from "@/app/components/library/schemas"
import { DropResult } from "@hello-pangea/dnd"

export default function Home() {
  const { status } = useSession()
  const router = useRouter()
  const { play: playVideo } = usePlayer()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/catalogo")
  }, [status, router])
  const [activeFilter, setActiveFilter] = useUrlState<ActiveFilter>("filter", "all", v => /^\d+$/.test(v) ? Number(v) : ["all", "unwatched", "watched", "favorites", "shared"].includes(v) ? v as ActiveFilter : "all")
  const [activeCollection, setActiveCollection] = useUrlState<number | null>("collection", null, v => Number(v) > 0 ? Number(v) : null)

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

  const [search, setSearch] = useUrlState("q", "", v => v)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [order, setOrder] = useUrlState("order", "newest", v => ["newest", "oldest", "az", "favorites", "manual"].includes(v) ? v : "newest")
  const [page, setPage] = useUrlState("page", 1, v => Math.max(1, Math.floor(Number(v)) || 1))
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(PALETTE[0])
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
  const [shareLinkMsg, setShareLinkMsg] = useState("")
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4500)
    return () => clearTimeout(t)
  }, [flash])

  const videoForm = useForm<VideoForm>({ resolver: zodResolver(videoSchema), defaultValues: { categoryIds: [] } })
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues: { categoryIds: [] } })
  const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const playlistForm = useForm<PlaylistForm>({ resolver: zodResolver(playlistSchema) })

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const videoCategoryIds = useWatch({ control: videoForm.control, name: "categoryIds" }) ?? []
  const editCategoryIds = useWatch({ control: editForm.control, name: "categoryIds" }) ?? []

  const loggedIn = status === "authenticated"

  const videoQueryString = (() => {
    const p = new URLSearchParams()
    if (typeof activeFilter === "number") p.set("categoryId", String(activeFilter))
    if (activeFilter === "watched") p.set("status", "watched")
    if (activeFilter === "unwatched") p.set("status", "unwatched")
    if (activeFilter === "favorites") p.set("status", "favorites")
    p.set("order", order)
    p.set("page", String(page))
    if (order === "manual") p.set("limit", "200")
    if (debouncedSearch.trim() && activeFilter !== "shared") p.set("q", debouncedSearch.trim())
    return p.toString()
  })()

  const videosQuery = useQuery({
    queryKey: ["library", "videos", videoQueryString, refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/videos?${videoQueryString}`)
      if (!res.ok) throw new Error("Falha ao carregar vídeos")
      return res.json()
    },
    enabled: loggedIn && activeFilter !== "shared",
  })
  const metaQuery = useQuery({
    queryKey: ["library", "meta", refreshKey],
    queryFn: async () => {
      const [cRes, colRes, sharedRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/collections"),
        fetch("/api/shared"),
      ])
      const [c, col, sh] = await Promise.all([cRes.json(), colRes.json(), sharedRes.json()])
      return {
        categories: Array.isArray(c) ? c as Category[] : [],
        collections: Array.isArray(col) ? col as Collection[] : [],
        sharedVideos: Array.isArray(sh) ? sh as Video[] : [],
      }
    },
    enabled: loggedIn,
  })
  const collectionVideosQuery = useQuery({
    queryKey: ["library", "collection-videos", activeCollection],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${activeCollection}/videos`)
      if (!res.ok) throw new Error("Falha ao carregar coleção")
      const v = await res.json()
      return Array.isArray(v) ? (v as Video[]) : []
    },
    enabled: loggedIn && activeCollection !== null,
  })

  const videos = itemsFromPaginated<Video>(videosQuery.data)
  const videoMeta = pageMeta(videosQuery.data)
  const categories = metaQuery.data?.categories ?? []
  const collections = metaQuery.data?.collections ?? []
  const sharedVideos = metaQuery.data?.sharedVideos ?? []
  const collectionVideos = collectionVideosQuery.data ?? []
  const loading = (activeFilter !== "shared" && videosQuery.isLoading) || metaQuery.isLoading

  const fetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["library"] })
  }

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
    setActiveFilter(f)
  }

  const openCollection = (id: number) => {
    setActiveCollection(id)
    setActiveFilter("all")
  }

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
    } catch { /* oembed opcional */ }
  }

  const onAddVideo = async (data: VideoForm) => {
    try {
      const res = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      if (res.ok) { videoForm.reset({ categoryIds: [] }); setUrlPreview(null); setShowAddVideo(false); fetchAll(); return }
      const d = await res.json().catch(() => null)
      setFlash({ text: typeof d?.error === "string" ? d.error : "Não foi possível adicionar o vídeo", ok: false })
    } catch {
      setFlash({ text: "Não foi possível adicionar o vídeo", ok: false })
    }
  }

  const onEditVideo = async (data: EditForm) => {
    if (!editVideo) return
    const res = await fetch(`/api/videos/${editVideo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
    if (res.ok) { setEditVideo(null); fetchAll(); return }
    const d = await res.json().catch(() => null)
    setFlash({ text: typeof d?.error === "string" ? d.error : "Não foi possível salvar", ok: false })
  }

  const patchVideoInCache = (id: number, patch: Partial<Video>) => {
    queryClient.setQueryData(["library", "videos", videoQueryString, refreshKey], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev
      const data = prev as { items?: Video[] }
      if (!Array.isArray(data.items)) return prev
      return { ...data, items: data.items.map((x) => x.id === id ? { ...x, ...patch } : x) }
    })
  }

  const deleteVideo = async (id: number) => {
    await fetch(`/api/videos/${id}`, { method: "DELETE" })
    fetchAll()
  }

  const toggleWatched = async (video: Video) => {
    const res = await fetch(`/api/videos/${video.id}/watched`, { method: "PATCH" })
    if (res.ok) { const d = await res.json(); patchVideoInCache(video.id, { watched: d.watched }) }
  }

  const toggleFavorite = async (video: Video) => {
    const res = await fetch(`/api/videos/${video.id}/favorite`, { method: "PATCH" })
    if (res.ok) { const d = await res.json(); patchVideoInCache(video.id, { favorite: d.favorite }) }
  }

  const openEdit = (video: Video) => {
    setEditVideo(video)
    editForm.reset({ title: video.title, channelName: video.channelName ?? "", duration: video.duration ?? "", notes: video.notes ?? "", categoryIds: video.videoCategories.map((vc) => vc.category.id) })
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
    if (res.ok) {
      const v = await res.json()
      playVideo(v)
    }
    else alert("Nenhum vídeo não assistido disponível")
  }

  const displayVideos: Video[] = activeCollection !== null
    ? collectionVideos
    : activeFilter === "shared"
      ? sharedVideos
      : videos

  const filtered = (activeCollection !== null || activeFilter === "shared")
    ? displayVideos.filter((v) =>
      v.title.toLowerCase().includes(search.toLowerCase()) ||
        (v.channelName ?? "").toLowerCase().includes(search.toLowerCase()),
    )
    : displayVideos

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const reordered = Array.from(filtered)
    const [removed] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, removed)
    queryClient.setQueryData(["library", "videos", videoQueryString, refreshKey], (prev: unknown) => {
      if (!prev || typeof prev !== "object") return prev
      const data = prev as { items?: Video[] }
      if (!Array.isArray(data.items)) return prev
      const ids = new Set(reordered.map((v) => v.id))
      return { ...data, items: [...reordered, ...data.items.filter((v) => !ids.has(v.id))] }
    })
    await Promise.all(reordered.map((v, i) => fetch(`/api/videos/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })))
  }

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
      setShareEntries((prev) => [...prev.filter((e) => e.to.id !== d.to.id), d])
      setShareEmail(""); setShareMsg("Compartilhado com sucesso!")
    } else { setShareMsg(d.error ?? "Erro ao compartilhar") }
  }

  const revokeShare = async (toUserId: number) => {
    if (!shareVideo) return
    await fetch(`/api/videos/${shareVideo.id}/share?userId=${toUserId}`, { method: "DELETE" })
    setShareEntries((prev) => prev.filter((e) => e.to.id !== toUserId))
  }

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
      setManageCollection((prev) => prev ? { ...prev, members: [...prev.members.filter((m) => m.userId !== d.userId), d] } : null)
    } else { setInviteMsg(d.error ?? "Erro ao convidar") }
  }

  const removeMember = async (userId: number) => {
    if (!manageCollection) return
    await fetch(`/api/collections/${manageCollection.id}/invite?userId=${userId}`, { method: "DELETE" })
    setManageCollection((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.userId !== userId) } : null)
    fetchAll()
  }

  const patchCollection = async (body: Record<string, unknown>) => {
    if (!manageCollection) return
    const res = await fetch(`/api/collections/${manageCollection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setShareLinkMsg(typeof d?.error === "string" ? d.error : "Não foi possível atualizar")
      return
    }
    setManageCollection((prev) => prev ? {
      ...prev,
      isPublic: d.isPublic ?? prev.isPublic,
      shareToken: d.shareToken ?? prev.shareToken,
      name: d.name ?? prev.name,
    } : null)
    fetchAll()
    return d
  }

  const togglePublic = async (isPublic: boolean) => {
    setShareLinkMsg("")
    const d = await patchCollection({ isPublic })
    if (d) setShareLinkMsg(isPublic ? "Link público ativo" : "Link público desligado")
  }

  const rotateLink = async () => {
    setShareLinkMsg("")
    const d = await patchCollection({ rotateLink: true })
    if (d) setShareLinkMsg("Novo link gerado. O anterior deixa de funcionar.")
  }

  const addVideoToCollection = async (collectionId: number, videoId: number) => {
    await fetch(`/api/collections/${collectionId}/videos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    })
    if (activeCollection === collectionId) {
      queryClient.invalidateQueries({ queryKey: ["library", "collection-videos", collectionId] })
    }
    setAddToCollection(null)
  }

  const removeVideoFromCollection = async (videoId: number) => {
    if (!activeCollection) return
    await fetch(`/api/collections/${activeCollection}/videos?videoId=${videoId}`, { method: "DELETE" })
    queryClient.invalidateQueries({ queryKey: ["library", "collection-videos", activeCollection] })
  }

  const totalSecs = filtered.reduce((a, v) => a + parseDurationToSeconds(v.duration), 0)
  const watchedCount = videos.filter((v) => v.watched).length
  const listTotal = activeCollection !== null
    ? collectionVideos.length
    : activeFilter === "shared"
      ? sharedVideos.length
      : videoMeta.total
  const currentCollection = activeCollection !== null ? collections.find((c) => c.id === activeCollection) : null

  if (status === "loading" || status === "unauthenticated") {
    return <div className="page"><div className="loading-center">Carregando...</div></div>
  }

  return (
    <div className="page">
      <AppHeader />

      {flash && (
        <div className={`toast ${flash.ok ? "toast-ok" : "toast-err"}`} role="status">
          {flash.text}
          <button type="button" className="toast-close" onClick={() => setFlash(null)} aria-label="Fechar">×</button>
        </div>
      )}

      <main id="conteudo" className="page-wrap">
        <div className="page-head">
          <div>
            <h1 className="page-title">Biblioteca</h1>
            <p className="page-sub">Organize o YouTube que você escolheu. Coleções com link público — você cura, não o algoritmo.</p>
          </div>
        </div>
        <LibraryToolbar
          search={search}
          onSearch={setSearch}
          onRandom={handleRandomVideo}
          onImport={() => setShowImport(true)}
          onPlaylist={() => setShowPlaylist(true)}
          onAddCategory={() => setShowAddCategory(true)}
          onAddVideo={() => setShowAddVideo(true)}
          onRefresh={() => { setRefreshing(true); setRefreshKey((k) => k + 1); setTimeout(() => setRefreshing(false), 800) }}
          refreshing={refreshing}
          activeFilter={activeFilter}
          activeCollection={activeCollection}
          onFilter={changeFilter}
          sharedCount={sharedVideos.length}
          categories={categories}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
          totalSecs={totalSecs}
          listTotal={listTotal}
          watchedCount={watchedCount}
          videosLength={videos.length}
          order={order}
          onOrder={setOrder}
          collections={collections}
          onNewCollection={() => setShowNewCollection(true)}
          onOpenCollection={openCollection}
          onManageCollection={(col) => { setManageCollection(col); setInviteMsg(""); setInviteEmail(""); setShareLinkMsg("") }}
          onDeleteCollection={deleteCollection}
          currentCollection={currentCollection ?? null}
          collectionVideoCount={collectionVideos.length}
          onCloseCollection={() => setActiveCollection(null)}
        />

        <LibraryGrid
          loading={loading}
          error={activeFilter !== "shared" && videosQuery.isError}
          filtered={filtered}
          gridFading={gridFading}
          order={order}
          activeCollection={activeCollection}
          activeFilter={String(activeFilter)}
          onDragEnd={onDragEnd}
          onWatch={playVideo}
          onDelete={(video) => activeCollection !== null ? removeVideoFromCollection(video.id) : deleteVideo(video.id)}
          onEdit={openEdit}
          canEdit={(video) => activeCollection === null && !(activeFilter === "shared" && video.permission !== "edit")}
          onToggleWatched={toggleWatched}
          onToggleFavorite={toggleFavorite}
          onShare={activeFilter !== "shared" && activeCollection === null ? openShare : undefined}
          onAddToCollection={activeCollection === null && activeFilter !== "shared" ? setAddToCollection : undefined}
          page={videoMeta.page}
          pageCount={videoMeta.pageCount}
          total={videoMeta.total}
          onPage={setPage}
        />
      </main>

      <LibraryModals
        categories={categories}
        collections={collections}
        videoForm={videoForm}
        editForm={editForm}
        categoryForm={categoryForm}
        playlistForm={playlistForm}
        videoCategoryIds={videoCategoryIds}
        editCategoryIds={editCategoryIds}
        showAddVideo={showAddVideo}
        urlPreview={urlPreview}
        onCloseAddVideo={() => { setShowAddVideo(false); videoForm.reset({ categoryIds: [] }); setUrlPreview(null) }}
        onVideoUrlChange={onVideoUrlChange}
        onAddVideo={onAddVideo}
        editVideo={editVideo}
        onCloseEdit={() => setEditVideo(null)}
        onEditVideo={onEditVideo}
        shareVideo={shareVideo}
        shareEntries={shareEntries}
        shareEmail={shareEmail}
        sharePermission={sharePermission}
        shareMsg={shareMsg}
        onShareEmail={setShareEmail}
        onSharePermission={setSharePermission}
        onCloseShare={() => { setShareVideo(null); setShareEntries([]) }}
        onShare={doShare}
        onRevokeShare={revokeShare}
        showAddCategory={showAddCategory}
        selectedColor={selectedColor}
        categoryMsg={categoryMsg}
        onCloseAddCategory={() => { setShowAddCategory(false); categoryForm.reset(); setCategoryMsg("") }}
        onSelectColor={setSelectedColor}
        onAddCategory={onAddCategory}
        showPlaylist={showPlaylist}
        playlistMsg={playlistMsg}
        playlistLoading={playlistLoading}
        onClosePlaylist={() => { setShowPlaylist(false); playlistForm.reset(); setPlaylistMsg("") }}
        onImportPlaylist={onImportPlaylist}
        showImport={showImport}
        importLoading={importLoading}
        onCloseImport={() => setShowImport(false)}
        onImportFile={handleImportFile}
        showNewCollection={showNewCollection}
        newCollectionName={newCollectionName}
        onCloseNewCollection={() => { setShowNewCollection(false); setNewCollectionName("") }}
        onNewCollectionName={setNewCollectionName}
        onCreateCollection={createCollection}
        manageCollection={manageCollection}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteMsg={inviteMsg}
        onCloseManage={() => { setManageCollection(null); setInviteMsg(""); setShareLinkMsg("") }}
        onInviteEmail={setInviteEmail}
        onInviteRole={setInviteRole}
        onInvite={doInvite}
        onRemoveMember={removeMember}
        onTogglePublic={togglePublic}
        onRotateLink={rotateLink}
        shareLinkMsg={shareLinkMsg}
        addToCollection={addToCollection}
        onCloseAddToCollection={() => setAddToCollection(null)}
        onAddToCollection={addVideoToCollection}
      />
    </div>
  )
}
