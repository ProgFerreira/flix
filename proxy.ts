import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rejectCrossOriginMutation } from "@/lib/csrf"

export async function proxy(req: NextRequest) {
  const csrf = rejectCrossOriginMutation(req)
  if (csrf) return csrf

  if (!req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const { getToken } = await import("next-auth/jwt")
  const { prisma } = await import("@/lib/prisma")
  const { adminGateDestination } = await import("@/lib/admin-gate")

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const tokenId = Number((token as { id?: string } | null)?.id)

  if (!token || !Number.isInteger(tokenId) || tokenId < 1) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  let user: { role: string; status: string } | null = null
  try {
    user = await prisma.user.findUnique({
      where: { id: tokenId },
      select: { role: true, status: true },
    })
  } catch {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  const destination = adminGateDestination(user)
  if (destination) {
    const url = req.nextUrl.clone()
    url.pathname = destination
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
}
