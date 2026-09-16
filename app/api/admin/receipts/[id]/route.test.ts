import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const requireAdmin = vi.fn()
const logAdminAction = vi.fn()
const prisma = {
  planPayment: { findUnique: vi.fn(), update: vi.fn() },
}
const detectReceiptMime = vi.fn()
const ensureReceiptDir = vi.fn()
const generateReceiptFilename = vi.fn()
const resolveReceiptPath = vi.fn()
const unlinkReceipt = vi.fn()
const writeFileSync = vi.fn()

vi.mock("@/lib/session", () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma }))
vi.mock("@/lib/audit", () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))
vi.mock("@/lib/receipt-storage", () => ({
  MAX_RECEIPT_BYTES: 8 * 1024 * 1024,
  detectReceiptMime: (...args: unknown[]) => detectReceiptMime(...args),
  ensureReceiptDir: (...args: unknown[]) => ensureReceiptDir(...args),
  generateReceiptFilename: (...args: unknown[]) => generateReceiptFilename(...args),
  resolveReceiptPath: (...args: unknown[]) => resolveReceiptPath(...args),
  unlinkReceipt: (...args: unknown[]) => unlinkReceipt(...args),
}))
vi.mock("fs", () => ({
  default: {
    writeFileSync: (...args: unknown[]) => writeFileSync(...args),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}))

describe("POST /api/admin/receipts/[id]", () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    logAdminAction.mockReset()
    prisma.planPayment.findUnique.mockReset()
    prisma.planPayment.update.mockReset()
    detectReceiptMime.mockReset()
    ensureReceiptDir.mockReset()
    generateReceiptFilename.mockReset()
    resolveReceiptPath.mockReset()
    unlinkReceipt.mockReset()
    writeFileSync.mockReset()
  })

  it("returns 403 for a non-admin", async () => {
    requireAdmin.mockResolvedValue(NextResponse.json({ error: "Acesso negado" }, { status: 403 }))
    const { POST } = await import("@/app/api/admin/receipts/[id]/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/receipts/3", { method: "POST" }), {
      params: Promise.resolve({ id: "3" }),
    })
    expect(res.status).toBe(403)
  })

  it("returns 404 when the payment does not exist", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planPayment.findUnique.mockResolvedValue(null)
    const { POST } = await import("@/app/api/admin/receipts/[id]/route")
    const res = await POST(new NextRequest("http://localhost/api/admin/receipts/9", { method: "POST" }), {
      params: Promise.resolve({ id: "9" }),
    })
    expect(res.status).toBe(404)
  })

  it("stores the receipt and logs the action", async () => {
    requireAdmin.mockResolvedValue({ userId: 1 })
    prisma.planPayment.findUnique.mockResolvedValue({ id: 9, receiptPath: null })
    detectReceiptMime.mockReturnValue("image/jpeg")
    generateReceiptFilename.mockReturnValue("r.jpg")
    resolveReceiptPath.mockReturnValue("/tmp/r.jpg")
    prisma.planPayment.update.mockResolvedValue({})

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "c.jpg", { type: "image/jpeg" })
    const req = new NextRequest("http://localhost/api/admin/receipts/9", { method: "POST" })
    vi.spyOn(req, "formData").mockResolvedValue({ get: () => file } as unknown as FormData)

    const { POST } = await import("@/app/api/admin/receipts/[id]/route")
    const res = await POST(req, { params: Promise.resolve({ id: "9" }) })
    expect(res.status).toBe(200)
    expect(writeFileSync).toHaveBeenCalled()
    expect(prisma.planPayment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 },
      data: expect.objectContaining({ receiptPath: "r.jpg", receiptMimeType: "image/jpeg" }),
    }))
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "payment.receipt",
      targetType: "payment",
      targetId: 9,
    }))
  })
})
