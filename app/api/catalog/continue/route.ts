import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, syncSubscriptionStatus, canAccessCatalogVideo } from "@/lib/session"
import { grantedVideoIdsForUser } from "@/lib/video-grants"
import { CONTINUE_FETCH, CONTINUE_MIN_SECONDS, selectContinueWatching, type ContinueVideo } from "@/lib/watch-continue"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  await syncSubscriptionStatus(userId)
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, role: true },
  })
  if (!requester) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const rows = await prisma.watchProgress.findMany({
    where: {
      userId,
      seconds: { gte: CONTINUE_MIN_SECONDS },
      video: { status: "ready" },
    },
    orderBy: { updatedAt: "desc" },
    take: CONTINUE_FETCH,
    select: {
      seconds: true,
      video: {
        select: {
          id: true, title: true, thumbnail: true, duration: true, channelName: true,
          source: true, videoId: true, requiredPlan: true, published: true, userId: true,
          previewPath: true,
        },
      },
    },
  })

  const grantIds = await grantedVideoIdsForUser(userId, rows.map((r) => r.video.id))
  const items = selectContinueWatching(rows, {
    userId,
    canAccess: (video: ContinueVideo) => canAccessCatalogVideo({
      isOwner: video.userId === userId,
      isAdmin: requester.role === "admin",
      published: video.published,
      requiredPlan: video.requiredPlan,
      requesterPlan: requester.plan,
      isGranted: grantIds.has(video.id),
    }),
  })

  return NextResponse.json({ items })
}
