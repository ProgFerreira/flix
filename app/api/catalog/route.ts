import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin, canAccessCatalogVideo, catalogVisiblePlanFilter } from "@/lib/session"
import { optionalCatalogRequester } from "@/lib/catalog-requester"
import { parsePageParams, paginated } from "@/lib/pagination"
import { parseYouTubeVideoId } from "@/lib/youtube-url"
import { getYouTubeThumbnail } from "@/lib/utils"
import { ownedCategoryIds } from "@/lib/categories"
import { claimVideoSlot, QuotaExceededError } from "@/lib/plan-quota"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { GrantLimitError, replaceVideoGrants, grantedVideoIdsForUser, viewerIdsSchema } from "@/lib/video-grants"
import { serializeVideo } from "@/lib/serialize-video"
import { logAdminAction } from "@/lib/audit"

const PUBLISH_LIMIT = 20
const PUBLISH_WINDOW_MS = 60 * 60 * 1000

const publishLinkSchema = z.object({
  url: z.string().url("URL inválida").max(500),
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  channelName: z.string().trim().max(120).optional(),
  duration: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).default("free"),
  published: z.boolean().default(true),
  categoryIds: z.array(z.number().int().positive()).max(20).optional(),
  viewerIds: viewerIdsSchema.optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  const plan = searchParams.get("plan")
  const favorited = searchParams.get("favorited") === "1"
  const mine = searchParams.get("mine") === "1"
  const paging = parsePageParams(searchParams)
  const requestedId = searchParams.get("video")
  const takenPromise = !mine && !requestedId
    ? prisma.courseLesson.findMany({ select: { videoId: true } })
    : Promise.resolve([] as { videoId: number }[])

  const requesterRow = await optionalCatalogRequester()
  const userId = requesterRow?.userId ?? null
  const requester = requesterRow
    ? { plan: requesterRow.plan, role: requesterRow.role }
    : null

  if ((favorited || mine) && !userId) {
    return NextResponse.json(paginated([], 0, paging.page, paging.pageSize))
  }

  const filters: Record<string, unknown>[] = []
  if (requestedId) {
    const id = Number(requestedId)
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json(paginated([], 0, paging.page, paging.pageSize))
    filters.push({ id })
  }
  if (mine && userId) {
    filters.push({ userId })
    // Link do YouTube só entra no catálogo quando publicado; arquivo pode ser rascunho.
    // Upload em processing/error também aparece pra o dono acompanhar o FFmpeg.
    filters.push({ OR: [{ published: true }, { source: "upload" }] })
    filters.push({ source: { in: ["youtube", "upload"] } })
  } else {
    filters.push({ status: "ready" })
    filters.push({ published: true })
    filters.push({ source: { in: ["youtube", "upload"] } })
    if (!requestedId) {
      const taken = await takenPromise
      if (taken.length > 0) {
        filters.push({ id: { notIn: taken.map((row) => row.videoId) } })
      }
    }
  }
  if (plan && ["free", "premium", "pro"].includes(plan)) {
    filters.push({ requiredPlan: plan })
  } else if (!mine && !requestedId) {
    const scope = catalogVisiblePlanFilter({
      requesterPlan: requester?.plan ?? "free",
      isAdmin: requester?.role === "admin",
      userId,
    })
    if (scope) filters.push(scope)
  }
  if (favorited && userId) filters.push({ favoritedBy: { some: { userId } } })
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q } },
        { channelName: { contains: q } },
      ],
    })
  }
  const where = { AND: filters }

  const [total, videos] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      select: {
        id: true, title: true, thumbnail: true, duration: true, channelName: true,
        createdAt: true, requiredPlan: true, userId: true, source: true, videoId: true,
        published: true, status: true, processError: true, previewPath: true, filePath: true,
        videoCategories: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: paging.skip,
      take: paging.take,
    }),
  ])

  const favoriteIds = new Set<number>()
  const progressByVideo = new Map<number, number>()
  let grantIds = new Set<number>()
  if (userId && videos.length > 0) {
    const ids = videos.map((v) => v.id)
    const [favs, progress, grants] = await Promise.all([
      prisma.favorite.findMany({ where: { userId, videoId: { in: ids } }, select: { videoId: true } }),
      prisma.watchProgress.findMany({ where: { userId, videoId: { in: ids } }, select: { videoId: true, seconds: true } }),
      grantedVideoIdsForUser(userId, ids),
    ])
    for (const f of favs) favoriteIds.add(f.videoId)
    for (const p of progress) progressByVideo.set(p.videoId, p.seconds)
    grantIds = grants
  }

  const catalog = videos.map(({ userId: ownerId, ...v }) => {
    const publicVideo = serializeVideo(v)
    return {
      ...publicVideo,
      mine: ownerId === userId,
      locked: !canAccessCatalogVideo({
        isOwner: ownerId === userId,
        isAdmin: requester?.role === "admin",
        published: v.published,
        requiredPlan: v.requiredPlan,
        requesterPlan: requester?.plan ?? "free",
        isGranted: grantIds.has(v.id),
      }),
      favorited: favoriteIds.has(v.id),
      progressSeconds: progressByVideo.get(v.id) ?? 0,
      processError: ownerId === userId ? v.processError : null,
    }
  })

  return NextResponse.json(paginated(catalog, total, paging.page, paging.pageSize))
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const ip = getClientIp(req.headers)
  const rl = await checkRateLimit(`catalog-publish:${userId}:${ip}`, PUBLISH_LIMIT, PUBLISH_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas publicações em pouco tempo. Tente de novo mais tarde." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = publishLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const videoId = parseYouTubeVideoId(parsed.data.url)
  if (!videoId) {
    return NextResponse.json({ error: "Informe um link de vídeo do YouTube" }, { status: 400 })
  }

  const categoryIds = await ownedCategoryIds(userId, parsed.data.categoryIds)
  const { url, title, requiredPlan, published, viewerIds } = parsed.data
  const channelName = parsed.data.channelName || undefined
  const duration = parsed.data.duration || undefined
  const notes = parsed.data.notes || undefined

  try {
    const video = await claimVideoSlot(userId, async (tx) => {
      const created = await tx.video.create({
        data: {
          userId,
          url,
          videoId,
          title,
          thumbnail: getYouTubeThumbnail(videoId),
          channelName,
          duration,
          notes,
          source: "youtube",
          status: "ready",
          published,
          requiredPlan,
          videoCategories: categoryIds.length
            ? { create: categoryIds.map((cid) => ({ categoryId: cid })) }
            : undefined,
        },
        include: { videoCategories: { include: { category: true } } },
      })
      if (viewerIds?.length) {
        await replaceVideoGrants(tx, { videoId: created.id, userIds: viewerIds, grantedBy: userId, ownerId: userId })
      }
      return created
    })
    await logAdminAction({
      adminId: userId,
      action: "video.upload",
      targetType: "video",
      targetId: video.id,
      meta: { title: video.title, source: "youtube" },
    })
    return NextResponse.json(video)
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof GrantLimitError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
