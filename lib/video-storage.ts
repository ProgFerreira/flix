import path from "path"
import fs from "fs"
import { randomUUID } from "crypto"

// Fora de /public — o arquivo só é servido através da rota de streaming autenticada.
export const STORAGE_DIR = path.join(process.cwd(), "storage", "videos")

export const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])
export const ALLOWED_EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
}
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024 * 1024 // 3GB

export type UploadValidation = { ok: true } | { ok: false; error: string }

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

export function ensureStorageDir(): void {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
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
