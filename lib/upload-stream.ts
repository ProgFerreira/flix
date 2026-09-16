import Busboy from "busboy"
import { Readable } from "stream"
import { createWriteStream } from "fs"
import { unlink, rename, copyFile, mkdir } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { randomUUID } from "crypto"
import { MAX_UPLOAD_BYTES, STORAGE_DIR } from "@/lib/video-storage"

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type StreamedUpload = {
  fields: Record<string, string>
  tempPath: string
  size: number
  header: Uint8Array
}

function nodeReadable(req: Request): Readable {
  if (!req.body) throw new UploadError("Corpo da requisição vazio")
  return Readable.fromWeb(req.body as import("stream/web").ReadableStream)
}

/** Grava o arquivo multipart em disco sem carregar o vídeo inteiro na RAM. */
export function streamMultipartVideo(req: Request, maxBytes = MAX_UPLOAD_BYTES): Promise<StreamedUpload> {
  const contentType = req.headers.get("content-type")
  if (!contentType?.includes("multipart/form-data")) {
    return Promise.reject(new UploadError("Envie o vídeo como multipart/form-data"))
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {}
    let settled = false
    let tempPath: string | null = null
    let size = 0
    let header = new Uint8Array(0)
    let fileSeen = false
    const headerChunks: Buffer[] = []
    let headerLen = 0

    const fail = async (err: unknown) => {
      if (settled) return
      settled = true
      if (tempPath) await unlink(tempPath).catch(() => undefined)
      reject(err instanceof UploadError ? err : new UploadError("Falha no upload"))
    }

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: maxBytes },
    })

    busboy.on("field", (name, value) => {
      fields[name] = value
    })

    busboy.on("file", (_name, file) => {
      fileSeen = true
      tempPath = path.join(tmpdir(), `flix-upload-${randomUUID()}`)
      const out = createWriteStream(tempPath)
      file.on("data", (chunk: Buffer) => {
        size += chunk.length
        if (headerLen < 16) {
          headerChunks.push(chunk)
          headerLen += chunk.length
          const buf = Buffer.concat(headerChunks)
          header = new Uint8Array(buf.subarray(0, Math.min(16, buf.length)))
        }
        if (size > maxBytes) {
          file.destroy()
          out.destroy()
          void fail(new UploadError(`Arquivo muito grande (máx. ${Math.floor(maxBytes / 1024 ** 3)}GB).`))
        }
      })
      file.on("limit", () => {
        file.destroy()
        out.destroy()
        void fail(new UploadError(`Arquivo muito grande (máx. ${Math.floor(maxBytes / 1024 ** 3)}GB).`))
      })
      file.pipe(out)
      out.on("error", (err) => { void fail(err) })
      file.on("error", (err) => { void fail(err) })
    })

    busboy.on("error", (err) => { void fail(err) })
    busboy.on("finish", () => {
      if (settled) return
      if (!fileSeen || !tempPath) {
        void fail(new UploadError("Arquivo de vídeo obrigatório"))
        return
      }
      if (size <= 0) {
        void fail(new UploadError("Arquivo vazio ou inválido."))
        return
      }
      settled = true
      resolve({ fields, tempPath, size, header })
    })

    nodeReadable(req).pipe(busboy)
  })
}

export async function moveUploadToStorage(tempPath: string, destFilename: string): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true })
  const dest = path.join(STORAGE_DIR, path.basename(destFilename))
  try {
    await rename(tempPath, dest)
  } catch {
    await copyFile(tempPath, dest)
    await unlink(tempPath).catch(() => undefined)
  }
  return dest
}

export async function removeStoredFile(absolutePath: string) {
  await unlink(absolutePath).catch(() => undefined)
}
