export type AdminCourse = {
  id: number
  title: string
  slug: string
  thumbnail: string | null
  requiredPlan: "free" | "premium" | "pro"
  published: boolean
  lessonCount: number
  moduleCount: number
}

export type LessonDraft = {
  videoId: number
  title: string
  thumbnail: string
  duration: string | null
  source?: "youtube" | "upload" | "article"
  notes?: string | null
  status?: string
}
export type ModuleDraft = { key: string; title: string; lessons: LessonDraft[] }

export type PickerVideo = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  requiredPlan: string
  published: boolean
  source?: "youtube" | "upload" | "article"
  status?: string
  inThisCourse: boolean
}
