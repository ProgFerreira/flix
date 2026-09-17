import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canAccessCatalogVideo, syncSubscriptionStatus } from "@/lib/session"
import { hasVideoGrant } from "@/lib/video-grants"

type CatalogVideoRow = {
  id: number
  source: "youtube" | "upload" | "article"
  published: boolean
  requiredPlan: string
  userId: number
}

/**
 * Vídeo privado da biblioteca (não publicado) não vaza existência pra
 * estranhos — 404. Plano insuficiente em item publicado é 403.
 */
export async function resolveCatalogAccess(
  userId: number,
  videoId: number,
): Promise<{ video: CatalogVideoRow } | { error: NextResponse }> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, source: true, published: true, requiredPlan: true, userId: true },
  })
  if (!video) {
    return { error: NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 }) }
  }

  await syncSubscriptionStatus(userId)
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, role: true },
  })
  if (!requester) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }

  const isOwner = video.userId === userId
  const isAdmin = requester.role === "admin"
  if (!video.published && !isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 }) }
  }

  const isGranted = !isOwner && !isAdmin
    ? await hasVideoGrant(video.id, userId)
    : false
  const allowed = canAccessCatalogVideo({
    isOwner,
    isAdmin,
    published: video.published,
    requiredPlan: video.requiredPlan,
    requesterPlan: requester.plan,
    isGranted,
  })
  if (!allowed) {
    return { error: NextResponse.json({ error: "Sua assinatura não dá acesso a este vídeo" }, { status: 403 }) }
  }

  return { video }
}
