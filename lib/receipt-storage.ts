import path from "path"
import fs from "fs"
import { randomUUID } from "crypto"

export const RECEIPT_DIR = path.join(process.cwd(), "storage", "receipts")
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
}

export function detectReceiptMime(header: Uint8Array): string | null {
  if (header.length < 12) return null
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return "image/jpeg"
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return "image/png"
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return "image/webp"
  const sig = String.fromCharCode(header[0], header[1], header[2], header[3])
  if (sig === "%PDF") return "application/pdf"
  return null
}

export function generateReceiptFilename(mimeType: string): string {
  return `${randomUUID()}${EXT[mimeType] ?? ".bin"}`
}

export function resolveReceiptPath(filename: string): string {
  return path.join(RECEIPT_DIR, path.basename(filename))
}

export function ensureReceiptDir(): void {
  fs.mkdirSync(RECEIPT_DIR, { recursive: true })
}

export function unlinkReceipt(filename: string | null | undefined): void {
  if (!filename) return
  try {
    fs.unlinkSync(resolveReceiptPath(filename))
  } catch {
    // arquivo já sumiu — não impede o resto da operação
  }
}
