import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { optionalCatalogRequester } from "@/lib/catalog-requester"
import { checkRateLimit } from "@/lib/rate-limit"
import { isCourseCardLocked, serializeCourseReviews } from "@/lib/course-public"
import { courseReviewWriteSchema, courseSlugSchema } from "@/validators/course"

async function loadVisibleCourse(slug: string, isAdmin: boolean) {
  const parsed = courseSlugSchema.safeParse(slug)
  if (!parsed.success) return null
  const course = await prisma.course.findUnique({
    where: { slug: parsed.data },
    select: { id: true, published: true, requiredPlan: true },
  })
  if (!course || (!course.published && !isAdmin)) return null
  return course
}

async function reviewsPayload(courseId: number, userId: number | null) {
  const rows = await prisma.courseReview.findMany({
    where: { courseId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  })
  return serializeCourseReviews(rows, userId)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const requester = await optionalCatalogRequester()
  const course = await loadVisibleCourse((await params).slug, requester?.role === "admin")
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  return NextResponse.json(await reviewsPayload(course.id, requester?.userId ?? null))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const slug = (await params).slug

  const rate = await checkRateLimit(`course-review:${auth.userId}`, 20, 60 * 60 * 1000)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Muitas avaliações. Tente novamente mais tarde." }, { status: 429 })
  }

  const requester = await optionalCatalogRequester()
  const course = await loadVisibleCourse(slug, requester?.role === "admin")
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  const access = requester ? { plan: requester.plan, role: requester.role } : null
  if (isCourseCardLocked(course.requiredPlan, access)) {
    return NextResponse.json({ error: "Sua assinatura não dá acesso a este curso" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = courseReviewWriteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const comment = parsed.data.comment === undefined ? null : parsed.data.comment
  await prisma.courseReview.upsert({
    where: { userId_courseId: { userId: auth.userId, courseId: course.id } },
    create: { userId: auth.userId, courseId: course.id, rating: parsed.data.rating, comment },
    update: { rating: parsed.data.rating, comment },
    include: { user: { select: { name: true } } },
  })
  return NextResponse.json(await reviewsPayload(course.id, auth.userId))
}
