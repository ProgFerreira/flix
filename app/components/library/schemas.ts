import { z } from "zod"

export const videoSchema = z.object({
  url: z.string().url("URL inválida"),
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
})
export const editSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
})
export const categorySchema = z.object({ name: z.string().min(1, "Nome obrigatório"), color: z.string().optional() })
export const playlistSchema = z.object({ url: z.string().url("URL inválida") })

export type VideoForm = z.infer<typeof videoSchema>
export type EditForm = z.infer<typeof editSchema>
export type CategoryForm = z.infer<typeof categorySchema>
export type PlaylistForm = z.infer<typeof playlistSchema>
