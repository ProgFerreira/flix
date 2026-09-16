import { prisma } from "@/lib/prisma"
import { uniqueCourseSlug } from "@/lib/course"
import { slugFromCourseInput } from "@/validators/course"

export async function allocateCourseSlug(title: string, preferred?: string, excludeId?: number) {
  const base = slugFromCourseInput(title, preferred)
  const existing = await prisma.course.findMany({
    where: {
      OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  })
  return uniqueCourseSlug(base, existing.map((row) => row.slug))
}

const lessonVideoSelect = {
  id: true,
  title: true,
  thumbnail: true,
  duration: true,
  channelName: true,
  source: true,
  videoId: true,
  published: true,
  status: true,
  requiredPlan: true,
  userId: true,
  notes: true,
  previewPath: true,
  filePath: true,
  playbackPath: true,
} as const

export const courseCurriculumInclude = {
  modules: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" as const },
        include: { video: { select: lessonVideoSelect } },
      },
    },
  },
}

export function flattenCourseLessons<
  T extends { lessons: { video: CourseLessonVideo }[] },
>(modules: T[]) {
  return modules.flatMap((module) => module.lessons.map((lesson) => lesson.video))
}

export type CourseLessonVideo = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  channelName: string | null
  source: "youtube" | "upload"
  videoId: string | null
  published: boolean
  status: string
  requiredPlan: string
  userId: number
  notes?: string | null
  previewPath: string | null
  filePath: string | null
  playbackPath: string | null
}
