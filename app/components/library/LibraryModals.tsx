"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ChevronDown, UserPlus, FolderOpen, Crown, Eye, Edit3, X, Link2, Copy } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import type { Category, Collection, ShareEntry, Video } from "@/app/components/library/types"
import { PALETTE } from "@/app/components/library/types"
import { avatar } from "@/app/components/library/helpers"
import { CategoryPicker, Field } from "@/app/components/library/LibraryBits"
import { Modal } from "@/app/components/Modal"
import type { CategoryForm, EditForm, PlaylistForm, VideoForm } from "@/app/components/library/schemas"

type Props = {
  categories: Category[]
  collections: Collection[]
  videoForm: UseFormReturn<VideoForm>
  editForm: UseFormReturn<EditForm>
  categoryForm: UseFormReturn<CategoryForm>
  playlistForm: UseFormReturn<PlaylistForm>
  videoCategoryIds: number[]
  editCategoryIds: number[]
  showAddVideo: boolean
  urlPreview: string | null
  onCloseAddVideo: () => void
  onVideoUrlChange: (url: string) => void
  onAddVideo: (data: VideoForm) => void
  editVideo: Video | null
  onCloseEdit: () => void
  onEditVideo: (data: EditForm) => void
  shareVideo: Video | null
  shareEntries: ShareEntry[]
  shareEmail: string
  sharePermission: "view" | "edit"
  shareMsg: string
  onShareEmail: (v: string) => void
  onSharePermission: (v: "view" | "edit") => void
  onCloseShare: () => void
  onShare: () => void
  onRevokeShare: (userId: number) => void
  showAddCategory: boolean
  selectedColor: string
  categoryMsg: string
  onCloseAddCategory: () => void
  onSelectColor: (c: string) => void
  onAddCategory: (data: CategoryForm) => void
  showPlaylist: boolean
  playlistMsg: string
  playlistLoading: boolean
  onClosePlaylist: () => void
  onImportPlaylist: (data: PlaylistForm) => void
  showImport: boolean
  importLoading: boolean
  onCloseImport: () => void
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  showNewCollection: boolean
  newCollectionName: string
  onCloseNewCollection: () => void
  onNewCollectionName: (v: string) => void
  onCreateCollection: () => void
  manageCollection: Collection | null
  inviteEmail: string
  inviteRole: "viewer" | "editor"
  inviteMsg: string
  onCloseManage: () => void
  onInviteEmail: (v: string) => void
  onInviteRole: (v: "viewer" | "editor") => void
  onInvite: () => void
  onRemoveMember: (userId: number) => void
  onTogglePublic: (isPublic: boolean) => void
  onRotateLink: () => void
  shareLinkMsg: string
  addToCollection: Video | null
  onCloseAddToCollection: () => void
  onAddToCollection: (collectionId: number, videoId: number) => void
}

export function LibraryModals(p: Props) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  return (
    <>
      <Modal open={p.showAddVideo} title="Adicionar Vídeo" description="Cole o link do YouTube e preencha os dados do vídeo." busy={p.videoForm.formState.isSubmitting} onClose={p.onCloseAddVideo}>
        <form onSubmit={p.videoForm.handleSubmit(p.onAddVideo)} className="stack-gap">
          <Field label="URL do YouTube" error={p.videoForm.formState.errors.url?.message}>
            <input {...p.videoForm.register("url", { onChange: (e) => p.onVideoUrlChange(e.target.value) })} placeholder="https://youtube.com/watch?v=..." className="input" />
          </Field>
          {p.urlPreview && (
            <div className="preview-thumb">
              <Image src={p.urlPreview} alt="" fill sizes="440px" style={{ objectFit: "cover" }} />
            </div>
          )}
          <Field label="Título" error={p.videoForm.formState.errors.title?.message}>
            <input {...p.videoForm.register("title")} placeholder="Nome do vídeo" className="input" />
          </Field>
          <div className="grid-2">
            <Field label="Canal"><input {...p.videoForm.register("channelName")} placeholder="Canal" className="input" /></Field>
            <Field label="Duração"><input {...p.videoForm.register("duration")} placeholder="5:32" className="input" /></Field>
          </div>
          <Field label="Notas"><textarea {...p.videoForm.register("notes")} placeholder="Anotações..." rows={2} className="textarea" /></Field>
          <Field label="Categorias">
            <CategoryPicker categories={p.categories} selected={p.videoCategoryIds} onChange={(ids) => p.videoForm.setValue("categoryIds", ids)} />
          </Field>
          <button type="submit" className="btn btn-accent btn-block" disabled={p.videoForm.formState.isSubmitting}>
            {p.videoForm.formState.isSubmitting ? "Salvando..." : "Salvar Vídeo"}
          </button>
        </form>
      </Modal>

      <Modal open={Boolean(p.editVideo)} title="Editar Vídeo" description="Atualize os dados deste vídeo da biblioteca." onClose={p.onCloseEdit}>
        <form onSubmit={p.editForm.handleSubmit(p.onEditVideo)} className="stack-gap">
          <Field label="Título" error={p.editForm.formState.errors.title?.message}>
            <input {...p.editForm.register("title")} className="input" />
          </Field>
          <div className="grid-2">
            <Field label="Canal"><input {...p.editForm.register("channelName")} className="input" /></Field>
            <Field label="Duração"><input {...p.editForm.register("duration")} className="input" /></Field>
          </div>
          <Field label="Notas"><textarea {...p.editForm.register("notes")} rows={3} className="textarea" /></Field>
          {p.editVideo && p.editVideo.permission !== "edit" && (
            <Field label="Categorias">
              <CategoryPicker categories={p.categories} selected={p.editCategoryIds} onChange={(ids) => p.editForm.setValue("categoryIds", ids)} />
            </Field>
          )}
          <button type="submit" className="btn btn-accent btn-block">Salvar Alterações</button>
        </form>
      </Modal>

      <Modal open={Boolean(p.shareVideo)} title="Compartilhar Vídeo" description={p.shareVideo ? `Convidar pessoas para ${p.shareVideo.title}.` : "Convidar pessoas para este vídeo."} onClose={p.onCloseShare}>
        <div className="invite-row">
          <div className="field">
            <label className="field-label" htmlFor="share-email">E-mail</label>
            <input id="share-email" className="input" value={p.shareEmail} onChange={(e) => p.onShareEmail(e.target.value)} placeholder="email@usuario.com"
              onKeyDown={(e) => e.key === "Enter" && p.onShare()} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="share-permission">Permissão</label>
            <div className="select-wrap">
              <select id="share-permission" className="select" value={p.sharePermission} onChange={(e) => p.onSharePermission(e.target.value as "view" | "edit")}>
                <option value="view">Ver</option>
                <option value="edit">Editar</option>
              </select>
              <ChevronDown size={12} className="select-ico" />
            </div>
          </div>
          <button type="button" onClick={p.onShare} className="btn btn-accent">Convidar</button>
        </div>
        {p.shareMsg && (
          <div className={`alert ${p.shareMsg.includes("sucesso") ? "alert-ok" : "alert-err"}`} role="status">{p.shareMsg}</div>
        )}
        {p.shareEntries.length > 0 && (
          <div>
            <p className="kicker">Com acesso</p>
            {p.shareEntries.map((e) => (
              <div key={e.id} className="list-row">
                <div className="avatar">{avatar(e.to)}</div>
                <div className="list-row-body">
                  <p className="list-row-title">{e.to.name ?? e.to.email}</p>
                  <p className="list-row-email">{e.to.email}</p>
                </div>
                <span className={`role-tag ${e.permission === "edit" ? "is-edit" : "is-view"}`}>
                  {e.permission === "edit" ? "Editor" : "Visualizador"}
                </span>
                <button type="button" onClick={() => p.onRevokeShare(e.to.id)} title="Remover acesso" className="icon-btn" aria-label="Remover acesso"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={p.showAddCategory} title="Nova Categoria" description="Dê um nome e uma cor para organizar os vídeos." onClose={p.onCloseAddCategory}>
        <form onSubmit={p.categoryForm.handleSubmit(p.onAddCategory)} className="stack-gap">
          <Field label="Nome" error={p.categoryForm.formState.errors.name?.message}>
            <input {...p.categoryForm.register("name")} placeholder="Ex: Música, Tutoriais..." className="input" />
          </Field>
          <Field label="Cor">
            <div className="swatch-row">
              {PALETTE.map((c) => (
                <button key={c} type="button" className={`swatch${p.selectedColor === c ? " is-on" : ""}`}
                  style={{ background: c, ["--chip-color" as string]: c }} onClick={() => p.onSelectColor(c)} aria-label={c} />
              ))}
            </div>
          </Field>
          {p.categoryMsg && <p className="field-error" role="alert">{p.categoryMsg}</p>}
          <button type="submit" className="btn btn-accent btn-block">Criar Categoria</button>
        </form>
      </Modal>

      <Modal open={p.showPlaylist} title="Importar Playlist" description="Informe a URL de uma playlist do YouTube." busy={p.playlistLoading} onClose={p.onClosePlaylist}>
        <form onSubmit={p.playlistForm.handleSubmit(p.onImportPlaylist)} className="stack-gap">
          <Field label="URL da Playlist do YouTube" error={p.playlistForm.formState.errors.url?.message}>
            <input {...p.playlistForm.register("url")} placeholder="https://youtube.com/playlist?list=..." className="input" />
          </Field>
          {p.playlistMsg && <p className={p.playlistMsg.includes("importado") ? "ok-text" : "field-error"} role="status">{p.playlistMsg}</p>}
          <button type="submit" className="btn btn-accent btn-block" disabled={p.playlistLoading}>{p.playlistLoading ? "Importando..." : "Importar"}</button>
        </form>
      </Modal>

      <Modal open={p.showImport} title="Importar JSON" description="Selecione um arquivo JSON exportado anteriormente." busy={p.importLoading} onClose={p.onCloseImport}>
        <input id="library-import-json" ref={importInputRef} type="file" accept=".json" onChange={p.onImportFile} className="hidden-input" />
        <button type="button" onClick={() => importInputRef.current?.click()} className="btn btn-accent btn-block" disabled={p.importLoading} aria-label="Selecionar arquivo JSON">
          {p.importLoading ? "Importando..." : "Selecionar arquivo"}
        </button>
      </Modal>

      <Modal open={p.showNewCollection} title="Nova Coleção" description="Agrupe vídeos e compartilhe com um link. Você (e seus amigos) curam — não o algoritmo." onClose={p.onCloseNewCollection}>
        <Field label="Nome da coleção">
          <input value={p.newCollectionName} onChange={(e) => p.onNewCollectionName(e.target.value)}
            placeholder="Ex: Favoritos da turma, Estudos..." className="input"
            onKeyDown={(e) => e.key === "Enter" && p.onCreateCollection()} autoFocus />
        </Field>
        <button type="button" onClick={p.onCreateCollection} className="btn btn-accent btn-block">Criar Coleção</button>
      </Modal>

      <Modal open={Boolean(p.manageCollection)} title="Link público e membros" description={p.manageCollection ? `Gerenciar ${p.manageCollection.name}.` : "Gerenciar coleção."} onClose={p.onCloseManage}>
        {p.manageCollection && (
          <>
          {p.manageCollection.myRole === "owner" && (
            <>
              <p className="kicker">Link público</p>
              <label className="check-box">
                <input
                  type="checkbox"
                  checked={Boolean(p.manageCollection.isPublic)}
                  onChange={(e) => p.onTogglePublic(e.target.checked)}
                />
                Qualquer pessoa com o link pode ver (só vídeos do YouTube)
              </label>
              {p.manageCollection.isPublic && p.manageCollection.shareToken && (
                <div className="share-link-row">
                  <input
                    className="input"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/c/${p.manageCollection.shareToken}`}
                    aria-label="Link público da coleção"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      const url = `${window.location.origin}/c/${p.manageCollection!.shareToken}`
                      void navigator.clipboard.writeText(url).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      })
                    }}
                  >
                    <Copy size={14} /> {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={p.onRotateLink}>
                    <Link2 size={14} /> Trocar
                  </button>
                </div>
              )}
              {(p.shareLinkMsg || copied) && (
                <p className={/não|erro|falha/i.test(p.shareLinkMsg) ? "field-error" : "ok-text"} role="status">
                  {copied ? "Link copiado" : p.shareLinkMsg}
                </p>
              )}
            </>
          )}
          {(p.manageCollection.myRole === "owner" || p.manageCollection.myRole === "editor") && (
            <>
              <p className="kicker">Convidar membro</p>
              <div className="invite-row">
                <div className="field">
                  <label className="field-label" htmlFor="invite-email">E-mail</label>
                  <input id="invite-email" className="input" value={p.inviteEmail} onChange={(e) => p.onInviteEmail(e.target.value)} placeholder="email@usuario.com"
                    onKeyDown={(e) => e.key === "Enter" && p.onInvite()} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="invite-role">Papel</label>
                  <div className="select-wrap">
                    <select id="invite-role" className="select" value={p.inviteRole} onChange={(e) => p.onInviteRole(e.target.value as "viewer" | "editor")}>
                      <option value="viewer">Visualizador</option>
                      <option value="editor">Editor</option>
                    </select>
                    <ChevronDown size={12} className="select-ico" />
                  </div>
                </div>
                <button type="button" onClick={p.onInvite} className="btn btn-accent" aria-label="Convidar"><UserPlus size={14} /></button>
              </div>
              {p.inviteMsg && <p className={p.inviteMsg.includes("adicionado") ? "ok-text" : "field-error"} role="status">{p.inviteMsg}</p>}
            </>
          )}
          <p className="kicker">Membros ({p.manageCollection.members.length})</p>
          {p.manageCollection.members.map((m) => (
            <div key={m.userId} className="list-row">
              <div className={`avatar${m.role === "owner" ? " avatar--accent" : ""}`}>{avatar(m.user)}</div>
              <div className="list-row-body">
                <p className="list-row-title">{m.user.name ?? m.user.email}</p>
                <p className="list-row-email">{m.user.email}</p>
              </div>
              <span className={`role-tag ${m.role === "owner" ? "is-owner" : m.role === "editor" ? "is-edit" : "is-view"}`}>
                {m.role === "owner" ? <><Crown size={9} /> Dono</> : m.role === "editor" ? <><Edit3 size={9} /> Editor</> : <><Eye size={9} /> Visualizador</>}
              </span>
              {p.manageCollection?.myRole === "owner" && m.role !== "owner" && (
                <button type="button" onClick={() => p.onRemoveMember(m.userId)} title="Remover" className="icon-btn" aria-label="Remover"><X size={13} /></button>
              )}
            </div>
          ))}
          </>
        )}
      </Modal>

      <Modal open={Boolean(p.addToCollection)} title="Adicionar à Coleção" description={p.addToCollection ? `Escolha uma coleção para ${p.addToCollection.title}.` : "Escolha uma coleção."} onClose={p.onCloseAddToCollection}>
        {p.collections.filter((c) => c.myRole !== "viewer").length === 0 ? (
          <p className="muted-2">Você não tem coleções onde pode adicionar vídeos.</p>
        ) : (
          <div className="pick-list">
            {p.collections.filter((c) => c.myRole !== "viewer").map((col) => (
              <button type="button" key={col.id} onClick={() => p.addToCollection && p.onAddToCollection(col.id, p.addToCollection.id)} className="pick-item">
                <FolderOpen size={16} color="#F97316" />
                <div>
                  <p className="list-row-title">{col.name}</p>
                  <p className="list-row-email">{col._count.videos} vídeo(s) · {col.members.length} membro(s)</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
