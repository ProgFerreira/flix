import { NextResponse } from "next/server"
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/session"
import { checkRateLimit } from "@/lib/rate-limit"
import { MAX_RECEIPT_BYTES, RECEIPT_DIR, detectReceiptMime, generateReceiptFilename, resolveReceiptPath, unlinkReceipt } from "@/lib/receipt-storage"

export const runtime = "nodejs"

async function receiptFile(req: Request): Promise<File | null> {
  const reader = req.body?.getReader()
  if (!reader) return null
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > MAX_RECEIPT_BYTES + 64 * 1024) { await reader.cancel(); throw new Error("too-large") }
    chunks.push(chunk.value)
  }
  const data = await new Request("http://localhost", {
    method: "POST", headers: { "content-type": req.headers.get("content-type") ?? "" }, body: Buffer.concat(chunks),
  }).formData()
  const file = data.get("file")
  return file instanceof File ? file : null
}

export async function POST(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const rate = await checkRateLimit(`receipt:${auth.userId}`, 10, 60 * 60 * 1000)
  if (!rate.allowed) return NextResponse.json({ error: "Muitos envios. Tente novamente mais tarde." }, { status: 429 })
  const pending = await prisma.planChangeRequest.findFirst({ where: { userId: auth.userId, status: "pending", toPlan: { not: "free" } } })
  if (!pending) return NextResponse.json({ error: "Nenhum pedido pago aguardando análise." }, { status: 409 })
  let filename: string | null = null
  try {
    const file = await receiptFile(req)
    if (!file || !file.size || file.size > MAX_RECEIPT_BYTES) return NextResponse.json({ error: "Envie um comprovante de até 8 MB." }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const mime = detectReceiptMime(bytes.subarray(0, 16))
    if (!mime) return NextResponse.json({ error: "Use um arquivo JPEG, PNG, WebP ou PDF válido." }, { status: 400 })
    filename = generateReceiptFilename(mime)
    await mkdir(RECEIPT_DIR, { recursive: true })
    await writeFile(resolveReceiptPath(filename), bytes, { flag: "wx" })
    const savedFilename = filename
    const old = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM PlanChangeRequest WHERE id = ${pending.id} FOR UPDATE`
      const current = await tx.planChangeRequest.findUnique({ where: { id: pending.id } })
      if (!current || current.status !== "pending") throw new Error("reviewed")
      await tx.planChangeRequest.update({ where: { id: current.id }, data: { receiptPath: savedFilename, receiptMimeType: mime, receiptSize: file.size } })
      return current.receiptPath
    })
    unlinkReceipt(old)
    return NextResponse.json({ ok: true })
  } catch (error) {
    unlinkReceipt(filename)
    const message = error instanceof Error ? error.message : ""
    if (message === "reviewed") return NextResponse.json({ error: "Este pedido já foi analisado. Atualize a página." }, { status: 409 })
    if (message === "too-large") return NextResponse.json({ error: "O comprovante deve ter até 8 MB." }, { status: 413 })
    return NextResponse.json({ error: "Não foi possível receber o comprovante. Verifique o arquivo e tente novamente." }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const auth = await requireUserId()
  if (auth instanceof NextResponse) return auth
  const id = Number(new URL(req.url).searchParams.get("id"))
  if (!Number.isSafeInteger(id) || id < 1) return new NextResponse(null, { status: 404 })
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } })
  const row = await prisma.planChangeRequest.findFirst({ where: { id, ...(user?.role === "admin" ? {} : { userId: auth.userId }) } })
  if (!row?.receiptPath) return new NextResponse(null, { status: 404 })
  try {
    const bytes = await readFile(resolveReceiptPath(row.receiptPath))
    const extension = row.receiptMimeType === "application/pdf" ? ".pdf" : row.receiptMimeType === "image/png" ? ".png" : row.receiptMimeType === "image/webp" ? ".webp" : ".jpg"
    return new NextResponse(bytes, { headers: {
      "Content-Type": row.receiptMimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="comprovante${extension}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } })
  } catch { return new NextResponse(null, { status: 404 }) }
}
