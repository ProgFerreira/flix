import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { optionalUserId, syncSubscriptionStatus, canAccessCatalogVideo } from "@/lib/session"

export async function GET() {
  const userId = await optionalUserId()

  let requester: { plan: string; role: string } | null = null
  if (userId) {
    await syncSubscriptionStatus(userId)
    requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
  }

  const videos = await prisma.video.findMany({
    where: { source: "upload", published: true, status: "ready" },
    select: {
      id: true, title: true, thumbnail: true, duration: true, channelName: true,
      createdAt: true, requiredPlan: true, userId: true,
      videoCategories: { include: { category: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const catalog = videos.map(({ userId: ownerId, ...v }) => ({
    ...v,
    locked: !canAccessCatalogVideo({
      isOwner: ownerId === userId,
      isAdmin: requester?.role === "admin",
      published: true,
      requiredPlan: v.requiredPlan,
      // visitante sem conta é tratado como "free": só destrava o que é gratuito
      requesterPlan: requester?.plan ?? "free",
    }),
  }))

  return NextResponse.json(catalog)
}
