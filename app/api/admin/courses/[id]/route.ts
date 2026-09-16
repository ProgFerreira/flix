import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { logAdminAction } from "@/lib/audit"
import { handlePrismaError } from "@/lib/api-error"
import { coursePatchSchema } from "@/validators/course"
import { allocateCourseSlug, courseCurriculumInclude } from "@/lib/course-query"

function parseCourseId(raw: string) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const id = parseCourseId((await params).id)
  if (!id) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  const course = await prisma.course.findUnique({
    where: { id },
    include: courseCurriculumInclude,
  })
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  return NextResponse.json(course)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const id = parseCourseId((await params).id)
  if (!id) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = coursePatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const current = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true } })
  if (!current) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  const { slug, title, description, learnings, thumbnail, requiredPlan, published, sortOrder } = parsed.data
  const data: Prisma.CourseUpdateInput = {}
  if (title !== undefined) data.title = title
  if (description !== undefined) data.description = description
  if (learnings !== undefined) data.learnings = learnings
  if (thumbnail !== undefined) data.thumbnail = thumbnail
  if (requiredPlan !== undefined) data.requiredPlan = requiredPlan
  if (published !== undefined) data.published = published
  if (sortOrder !== undefined) data.sortOrder = sortOrder
  if (slug) {
    data.slug = await allocateCourseSlug(title ?? current.title, slug, id)
  }

  try {
    const course = await prisma.course.update({ where: { id }, data })
    await logAdminAction({
      adminId: auth.userId,
      action: "course.update",
      targetType: "course",
      targetId: course.id,
      meta: { title: course.title, slug: course.slug },
    })
    return NextResponse.json(course)
  } catch (err) {
    const handled = handlePrismaError(err, {
      duplicate: "Já existe um curso com este slug",
      notFound: "Curso não encontrado",
    })
    if (handled) return handled
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const id = parseCourseId((await params).id)
  if (!id) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  try {
    const course = await prisma.course.delete({ where: { id }, select: { id: true, title: true, slug: true } })
    await logAdminAction({
      adminId: auth.userId,
      action: "course.delete",
      targetType: "course",
      targetId: course.id,
      meta: { title: course.title, slug: course.slug },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const handled = handlePrismaError(err, { notFound: "Curso não encontrado" })
    if (handled) return handled
    throw err
  }
}
