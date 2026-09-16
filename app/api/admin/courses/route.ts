import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePageParams, paginated } from "@/lib/pagination"
import { logAdminAction } from "@/lib/audit"
import { handlePrismaError } from "@/lib/api-error"
import { courseWriteSchema } from "@/validators/course"
import { allocateCourseSlug } from "@/lib/course-query"

function lessonCountFrom(modules: { _count: { lessons: number } }[]) {
  return modules.reduce((sum, module) => sum + module._count.lessons, 0)
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const paging = parsePageParams(new URL(req.url).searchParams)
  const [total, courses] = await Promise.all([
    prisma.course.count(),
    prisma.course.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: paging.skip,
      take: paging.take,
      include: {
        modules: { select: { _count: { select: { lessons: true } } } },
      },
    }),
  ])

  return NextResponse.json(paginated(
    courses.map(({ modules, ...course }) => ({
      ...course,
      lessonCount: lessonCountFrom(modules),
      moduleCount: modules.length,
    })),
    total,
    paging.page,
    paging.pageSize,
  ))
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = courseWriteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const { title, slug, description, learnings, thumbnail, requiredPlan, published, sortOrder } = parsed.data
  try {
    const course = await prisma.course.create({
      data: {
        title,
        slug: await allocateCourseSlug(title, slug),
        description,
        learnings,
        thumbnail,
        requiredPlan: requiredPlan ?? "free",
        published: published ?? false,
        sortOrder: sortOrder ?? 0,
      },
    })
    await logAdminAction({
      adminId: auth.userId,
      action: "course.create",
      targetType: "course",
      targetId: course.id,
      meta: { title: course.title, slug: course.slug },
    })
    return NextResponse.json(course, { status: 201 })
  } catch (err) {
    const handled = handlePrismaError(err, { duplicate: "Já existe um curso com este slug" })
    if (handled) return handled
    throw err
  }
}
