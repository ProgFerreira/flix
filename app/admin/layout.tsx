import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { adminGateDestination } from "@/lib/admin-gate"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { role: true, status: true },
  })
  const destination = adminGateDestination(user)
  if (destination) redirect(destination)

  return <div className="admin-shell">{children}</div>
}
