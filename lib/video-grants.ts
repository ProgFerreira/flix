import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const MAX_VIDEO_GRANTS = 50

export const viewerIdsSchema = z.array(z.number().int().positive()).max(MAX_VIDEO_GRANTS)

export class GrantLimitError extends Error {
  constructor() {
    super(`No máximo ${MAX_VIDEO_GRANTS} usuários extras por vídeo`)
    this.name = "GrantLimitError"
  }
}

type Db = Prisma.TransactionClient | typeof prisma

export type GrantUser = { id: number; name: string | null; email: string; plan: string }

/** FormData / JSON cru: omitido = undefined (não mexe); [] = zera a lista. */
export function parseViewerIdsField(raw: string | undefined): { ok: true; ids?: number[] } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, ids: undefined }
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = viewerIdsSchema.safeParse(parsed)
    if (!result.success) return { ok: false, error: "viewerIds inválido" }
    return { ok: true, ids: result.data }
  } catch {
    return { ok: false, error: "viewerIds inválido" }
  }
}

/**
 * Deduplica, tira o dono, ignora bloqueados/inexistentes.
 * Estoura se passar do teto *antes* de filtrar no banco — senão alguém
 * mandaria 10 mil IDs só pra forçar o SELECT.
 */
export async function resolveGrantUserIds(db: Db, ids: number[], ownerId: number): Promise<number[]> {
  const unique: number[] = []
  const seen = new Set<number>()
  for (const id of ids) {
    if (!Number.isInteger(id) || id < 1 || id === ownerId || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  if (unique.length > MAX_VIDEO_GRANTS) throw new GrantLimitError()
  if (unique.length === 0) return []

  const rows = await db.user.findMany({
    where: { id: { in: unique }, status: "active", deletadoEm: null },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function replaceVideoGrants(
  tx: Prisma.TransactionClient,
  opts: { videoId: number; userIds: number[]; grantedBy: number; ownerId: number },
) {
  const ids = await resolveGrantUserIds(tx, opts.userIds, opts.ownerId)
  await tx.videoAccessGrant.deleteMany({ where: { videoId: opts.videoId } })
  if (ids.length === 0) return
  await tx.videoAccessGrant.createMany({
    data: ids.map((userId) => ({
      videoId: opts.videoId,
      userId,
      grantedBy: opts.grantedBy,
    })),
  })
}

export async function listVideoGrants(videoId: number): Promise<GrantUser[]> {
  const rows = await prisma.videoAccessGrant.findMany({
    where: { videoId },
    include: { user: { select: { id: true, name: true, email: true, plan: true } } },
    orderBy: { createdAt: "asc" },
  })
  return rows.map((r) => r.user)
}

export async function hasVideoGrant(videoId: number, userId: number): Promise<boolean> {
  const row = await prisma.videoAccessGrant.findUnique({
    where: { videoId_userId: { videoId, userId } },
    select: { videoId: true },
  })
  return Boolean(row)
}

export async function grantedVideoIdsForUser(userId: number, videoIds: number[]): Promise<Set<number>> {
  if (videoIds.length === 0) return new Set()
  const rows = await prisma.videoAccessGrant.findMany({
    where: { userId, videoId: { in: videoIds } },
    select: { videoId: true },
  })
  return new Set(rows.map((r) => r.videoId))
}

export async function loadManagedCatalogVideo(userId: number, videoId: number) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, userId: true, source: true, filePath: true, previewPath: true, playbackPath: true, thumbPath: true, published: true },
  })
  if (!video) {
    return { error: NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 }) }
  }
  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (video.userId !== userId && requester?.role !== "admin") {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 403 }) }
  }
  return { video }
}
