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

export type LessonDraft = { videoId: number; title: string; thumbnail: string; duration: string | null }
export type ModuleDraft = { key: string; title: string; lessons: LessonDraft[] }

export type PickerVideo = {
  id: number
  title: string
  thumbnail: string
  duration: string | null
  requiredPlan: string
  published: boolean
  inThisCourse: boolean
}
