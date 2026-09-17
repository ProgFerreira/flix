import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { logAdminAction } from "@/lib/audit"
import { handlePrismaError } from "@/lib/api-error"
import { curriculumSchema } from "@/validators/course"
import { courseCurriculumInclude } from "@/lib/course-query"

function parseCourseId(raw: string) {
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const courseId = parseCourseId((await params).id)
  if (!courseId) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = curriculumSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }

  const exists = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, requiredPlan: true } })
  if (!exists) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })

  const videoIds = parsed.data.modules.flatMap((module) => module.lessons.map((lesson) => lesson.videoId))
  if (new Set(videoIds).size !== videoIds.length) {
    return NextResponse.json({ error: "A mesma aula não pode entrar duas vezes no curso" }, { status: 400 })
  }

  if (videoIds.length > 0) {
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      select: { id: true },
    })
    if (videos.length !== videoIds.length) {
      return NextResponse.json({ error: "Uma das aulas escolhidas não existe" }, { status: 400 })
    }
    const taken = await prisma.courseLesson.findMany({
      where: { videoId: { in: videoIds }, module: { courseId: { not: courseId } } },
      select: { videoId: true },
    })
    if (taken.length > 0) {
      return NextResponse.json({ error: "Esta aula já pertence a outro curso" }, { status: 409 })
    }
  }

  try {
    const course = await prisma.$transaction(async (tx) => {
      await tx.courseModule.deleteMany({ where: { courseId } })
      for (const [moduleIndex, module] of parsed.data.modules.entries()) {
        await tx.courseModule.create({
          data: {
            courseId,
            title: module.title,
            sortOrder: moduleIndex,
            lessons: {
              create: module.lessons.map((lesson, lessonIndex) => ({
                videoId: lesson.videoId,
                sortOrder: lessonIndex,
              })),
            },
          },
        })
      }
      if (videoIds.length > 0) {
        await tx.video.updateMany({
          where: { id: { in: videoIds }, published: false },
          data: { published: true, requiredPlan: exists.requiredPlan },
        })
      }
      return tx.course.findUniqueOrThrow({
        where: { id: courseId },
        include: courseCurriculumInclude,
      })
    })
    await logAdminAction({
      adminId: auth.userId,
      action: "course.update",
      targetType: "course",
      targetId: courseId,
      meta: { title: exists.title, curriculum: true, modules: parsed.data.modules.length },
    })
    return NextResponse.json(course)
  } catch (err) {
    const handled = handlePrismaError(err, { duplicate: "Esta aula já pertence a outro curso" })
    if (handled) return handled
    throw err
  }
}
