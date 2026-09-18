import { randomUUID } from "crypto"
import { unlink } from "fs/promises"
import { PLACEHOLDER_THUMB, resolveThumbPath } from "@/lib/video-storage"

export const MAX_LESSON_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
}

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
}

/** Lê os primeiros bytes (não o `file.type` do navegador) pra saber se é JPEG, PNG ou WebP. */
export function detectImageMime(header: Uint8Array): string | null {
  if (header.length < 12) return null
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return "image/jpeg"
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return "image/png"
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return "image/webp"
  return null
}

export function generateImageThumbFilename(mimeType: string): string {
  return `${randomUUID()}${IMAGE_EXT[mimeType] ?? ".jpg"}`
}

export function thumbContentType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase()
  return CONTENT_TYPE[ext] ?? "image/jpeg"
}

export async function unlinkLessonThumb(filename: string | null | undefined): Promise<void> {
  if (!filename) return
  await unlink(resolveThumbPath(filename)).catch(() => undefined)
}

export { PLACEHOLDER_THUMB }
