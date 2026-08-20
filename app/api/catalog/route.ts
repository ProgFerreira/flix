import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId, syncSubscriptionStatus, canAccessCatalogVideo } from "@/lib/session"

export async function GET() {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  await syncSubscriptionStatus(userId)
  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, role: true } })
  if (!requester) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })

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
      isAdmin: requester.role === "admin",
      published: true,
      requiredPlan: v.requiredPlan,
      requesterPlan: requester.plan,
    }),
  }))

  return NextResponse.json(catalog)
}
