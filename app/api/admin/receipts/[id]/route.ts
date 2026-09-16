import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { parsePositiveInt } from "@/lib/admin-users"
import { logAdminAction } from "@/lib/audit"
import {
  MAX_RECEIPT_BYTES,
  detectReceiptMime,
  ensureReceiptDir,
  generateReceiptFilename,
  resolveReceiptPath,
  unlinkReceipt,
} from "@/lib/receipt-storage"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const paymentId = parsePositiveInt(id)
  if (!paymentId) return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 })

  const payment = await prisma.planPayment.findUnique({
    where: { id: paymentId },
    select: { receiptPath: true, receiptMimeType: true },
  })
  if (!payment?.receiptPath) return NextResponse.json({ error: "Comprovante não encontrado" }, { status: 404 })

  const filePath = resolveReceiptPath(payment.receiptPath)
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Arquivo ausente" }, { status: 404 })

  const buf = fs.readFileSync(filePath)
  const mime = payment.receiptMimeType ?? "application/octet-stream"
  const inline = mime.startsWith("image/")
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${payment.receiptPath}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId: adminId } = auth

  const { id } = await params
  const paymentId = parsePositiveInt(id)
  if (!paymentId) return NextResponse.json({ error: "Pagamento inválido" }, { status: 400 })

  const payment = await prisma.planPayment.findUnique({
    where: { id: paymentId },
    select: { id: true, receiptPath: true },
  })
  if (!payment) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 })

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo do comprovante" }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: "Comprovante deve ter até 8 MB" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const mime = detectReceiptMime(buf.subarray(0, 16))
  if (!mime) {
    return NextResponse.json({ error: "Envie JPEG, PNG, WebP ou PDF" }, { status: 400 })
  }

  ensureReceiptDir()
  const filename = generateReceiptFilename(mime)
  fs.writeFileSync(resolveReceiptPath(filename), buf)

  await prisma.planPayment.update({
    where: { id: paymentId },
    data: { receiptPath: filename, receiptMimeType: mime, receiptSize: buf.length },
  })
  unlinkReceipt(payment.receiptPath)
  await logAdminAction({
    adminId,
    action: "payment.receipt",
    targetType: "payment",
    targetId: paymentId,
    meta: { mime, size: buf.length },
  })
  return NextResponse.json({ ok: true, hasReceipt: true })
}
