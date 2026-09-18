import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { courseSlugSchema } from "@/validators/course"

export async function PATCH(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const parsed = courseSlugSchema.safeParse((await params).slug)
  if (!parsed.success) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  const course = await prisma.course.findUnique({
    where: { slug: parsed.data },
    select: { id: true, published: true },
  })
  if (!course?.published) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  }

  const existing = await prisma.courseFavorite.findUnique({
    where: { userId_courseId: { userId: auth.userId, courseId: course.id } },
  })
  if (existing) {
    await prisma.courseFavorite.delete({ where: { id: existing.id } })
    return NextResponse.json({ favorited: false })
  }
  await prisma.courseFavorite.create({ data: { userId: auth.userId, courseId: course.id } })
  return NextResponse.json({ favorited: true })
}
