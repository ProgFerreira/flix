import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncSubscriptionStatus } from "@/lib/session"

export type CatalogRequester = {
  userId: number
  plan: string
  role: string
}

export async function resolveCatalogRequester(userId: number): Promise<CatalogRequester | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true, plan: true, deletadoEm: true },
  })
  if (!user || user.deletadoEm || user.status === "blocked") return null

  const sub = await syncSubscriptionStatus(userId)
  return {
    userId,
    plan: sub?.status === "expired" ? "free" : user.plan,
    role: user.role,
  }
}

export async function optionalCatalogRequester(): Promise<CatalogRequester | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return resolveCatalogRequester(Number(session.user.id))
}
