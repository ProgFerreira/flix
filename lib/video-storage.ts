import path from "path"
import fs from "fs"
import { unlink } from "fs/promises"
import { randomUUID } from "crypto"

// Fora de /public — o arquivo só é servido através da rota de streaming autenticada.
export const STORAGE_DIR = path.join(process.cwd(), "storage", "videos")
export const THUMBS_DIR = path.join(process.cwd(), "storage", "thumbs")
export const PLACEHOLDER_THUMB = "/video-placeholder.svg"

export const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])
export const ALLOWED_EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
}
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024 * 1024 // 3GB

export type UploadValidation = { ok: true } | { ok: false; error: string }

/**
 * Lê os primeiros bytes do arquivo (não o `file.type` do navegador) pra
 * saber se é MP4, WebM ou QuickTime. Sem isso, um PDF/HTML renomeado pra
 * .mp4 passaria na validação de MIME.
 */
export function detectVideoMime(header: Uint8Array): string | null {
  if (header.length < 12) return null

  // WebM / Matroska: EBML header 1A 45 DF A3
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
    return "video/webm"
  }

  // ISO BMFF: tamanho (4 bytes) + "ftyp" + brand (4 bytes)
  const box = String.fromCharCode(header[4], header[5], header[6], header[7])
  if (box === "ftyp") {
    const brand = String.fromCharCode(header[8], header[9], header[10], header[11])
    if (brand.startsWith("qt") || brand === "mqt ") return "video/quicktime"
    return "video/mp4"
  }

  return null
}

export function validateUpload(file: { mimeType: string; size: number }): UploadValidation {
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return { ok: false, error: `Formato não suportado (${file.mimeType || "desconhecido"}). Envie MP4, WebM ou MOV.` }
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "Arquivo vazio ou inválido." }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Arquivo muito grande (máx. ${Math.floor(MAX_UPLOAD_BYTES / 1024 ** 3)}GB).` }
  }
  return { ok: true }
}

/** Nome de arquivo aleatório e seguro pra gravar em disco — nunca usa o nome original do upload. */
export function generateStoredFilename(mimeType: string): string {
  const ext = ALLOWED_EXTENSIONS[mimeType] ?? ".mp4"
  return `${randomUUID()}${ext}`
}

/** Resolve o caminho absoluto de um arquivo já salvo, blindado contra path traversal. */
export function resolveStoredFilePath(filename: string): string {
  const safeName = path.basename(filename)
  return path.join(STORAGE_DIR, safeName)
}

export function resolveThumbPath(filename: string): string {
  return path.join(THUMBS_DIR, path.basename(filename))
}

export function generateThumbFilename(): string {
  return `${randomUUID()}.jpg`
}

export function generateDerivedFilename(): string {
  return `${randomUUID()}.mp4`
}

export function ensureStorageDir(): void {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

export function ensureThumbsDir(): void {
  fs.mkdirSync(THUMBS_DIR, { recursive: true })
}

export type VideoAssetPaths = {
  filePath?: string | null
  previewPath?: string | null
  playbackPath?: string | null
  thumbPath?: string | null
}

export async function removeVideoFiles(paths: VideoAssetPaths): Promise<void> {
  const abs = new Set<string>()
  if (paths.filePath) abs.add(resolveStoredFilePath(paths.filePath))
  if (paths.previewPath) abs.add(resolveStoredFilePath(paths.previewPath))
  if (paths.playbackPath) abs.add(resolveStoredFilePath(paths.playbackPath))
  if (paths.thumbPath) abs.add(resolveThumbPath(paths.thumbPath))
  await Promise.all([...abs].map((p) => unlink(p).catch(() => undefined)))
}

export type StreamQuality = "480" | "source"

export function pickStreamAsset(
  video: {
    filePath: string
    previewPath?: string | null
    playbackPath?: string | null
    mimeType?: string | null
  },
  quality?: string | null,
): { filename: string; mimeType: string } {
  const wantSource = quality === "source"
  const want480 = quality === "480" || quality == null || quality === "" || quality === "auto"

  if (want480 && !wantSource && video.previewPath) {
    return { filename: video.previewPath, mimeType: "video/mp4" }
  }
  if (wantSource) {
    return { filename: video.filePath, mimeType: video.mimeType ?? "video/mp4" }
  }
  if (video.playbackPath) {
    return { filename: video.playbackPath, mimeType: "video/mp4" }
  }
  return { filename: video.filePath, mimeType: video.mimeType ?? "video/mp4" }
}

/** ETag forte a partir de tamanho + mtime — o stream é paywalled, então
 *  o cache é só revalidação (`private, no-cache`), nunca CDN pública. */
export function fileCacheTag(stat: { size: number; mtimeMs?: number }): string {
  const mtimeMs = stat.mtimeMs
  const mtime = typeof mtimeMs === "number" && Number.isFinite(mtimeMs) ? Math.trunc(mtimeMs) : 0
  return `"${stat.size}-${mtime}"`
}

export type ByteRange = { start: number; end: number }

/**
 * Parseia o header `Range` (RFC 7233, só o caso simples de um range) pra
 * permitir seek no player de vídeo. Retorna null quando não há range
 * (servir o arquivo inteiro) ou quando o header é inválido/não-satisfazível.
 */
export function parseRangeHeader(header: string | null | undefined, fileSize: number): ByteRange | null {
  if (!header || fileSize <= 0) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, startStr, endStr] = match
  if (startStr === "" && endStr === "") return null

  let start: number
  let end: number

  if (startStr === "") {
    // range de sufixo: últimos N bytes
    const suffixLength = parseInt(endStr, 10)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
    start = Math.max(fileSize - suffixLength, 0)
    end = fileSize - 1
  } else {
    start = parseInt(startStr, 10)
    end = endStr === "" ? fileSize - 1 : parseInt(endStr, 10)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (end > fileSize - 1) end = fileSize - 1
  if (start < 0 || start > end) return null

  return { start, end }
}
