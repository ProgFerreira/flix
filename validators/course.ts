import { z } from "zod"
import { COURSE_SLUG_RE, slugifyCourseTitle } from "@/lib/course"

const planSchema = z.enum(["free", "premium", "pro"])

const optionalText = z
  .union([z.string().trim().max(4000), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null))

const thumbnailSchema = z
  .union([z.string().trim().max(500), z.null()])
  .optional()
  .refine(
    (value) => value == null || value === "" || value.startsWith("/") || /^https?:\/\//i.test(value),
    "Informe um caminho interno ou uma URL http(s)",
  )
  .transform((value) => (value === undefined ? undefined : value ? value : null))

export const courseSlugSchema = z
  .string()
  .trim()
  .min(1, "Slug obrigatório")
  .max(80)
  .regex(COURSE_SLUG_RE, "Use só letras minúsculas, números e hífen")

export const courseWriteSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  slug: courseSlugSchema.optional(),
  description: optionalText,
  learnings: optionalText,
  thumbnail: thumbnailSchema,
  requiredPlan: planSchema.optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const coursePatchSchema = courseWriteSchema.partial()

export const curriculumSchema = z.object({
  modules: z.array(z.object({
    title: z.string().trim().min(1, "Título do módulo obrigatório").max(200),
    lessons: z.array(z.object({
      videoId: z.number().int().positive(),
    })).max(100),
  })).max(50),
})

export function slugFromCourseInput(title: string, slug?: string): string {
  return slug ?? slugifyCourseTitle(title)
}

export type CourseWriteInput = z.infer<typeof courseWriteSchema>
export type CoursePatchInput = z.infer<typeof coursePatchSchema>
export type CurriculumInput = z.infer<typeof curriculumSchema>
