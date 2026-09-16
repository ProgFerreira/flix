import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), rate: vi.fn(), find: vi.fn(), user: vi.fn(), current: vi.fn(), update: vi.fn(), transaction: vi.fn(),
  write: vi.fn(), read: vi.fn(), unlink: vi.fn(),
}))
vi.mock("@/lib/session", () => ({ requireUserId: mocks.auth }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, planChangeRequest: { findFirst: mocks.find }, $transaction: mocks.transaction } }))
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: mocks.write, readFile: mocks.read }))
vi.mock("@/lib/receipt-storage", async importOriginal => ({ ...await importOriginal<object>(), unlinkReceipt: mocks.unlink }))
import { GET, POST } from "./route"

function upload(bytes = Buffer.from("%PDF-1.4\nexample content")) {
  const form = new FormData(); form.set("file", new File([bytes], "receipt.pdf", { type: "application/pdf" }))
  return new Request("http://localhost/api/plano/comprovante", { method: "POST", body: form })
}
describe("plan receipt access and upload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ userId: 7 }); mocks.rate.mockResolvedValue({ allowed: true })
    mocks.find.mockResolvedValue({ id: 2, status: "pending" }); mocks.user.mockResolvedValue({ role: "user" })
    mocks.current.mockResolvedValue({ id: 2, status: "pending", receiptPath: null })
    mocks.transaction.mockImplementation(fn => fn({ $queryRaw: vi.fn(), planChangeRequest: { findUnique: mocks.current, update: mocks.update } }))
  })
  it("rejects unauthenticated uploads", async () => {
    mocks.auth.mockResolvedValue(new NextResponse(null, { status: 401 }))
    expect((await POST(upload())).status).toBe(401)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("only loads the owner's receipt for non-admin users", async () => {
    mocks.find.mockResolvedValue(null)
    expect((await GET(new Request("http://localhost/api/plano/comprovante?id=2"))).status).toBe(404)
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: 2, userId: 7 } })
  })
  it("accepts a PDF for a pending paid request without activating the plan", async () => {
    expect((await POST(upload())).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ receiptMimeType: "application/pdf" }) }))
  })
  it("rejects a forged MIME type", async () => {
    expect((await POST(upload(Buffer.from("this is not a pdf file")))).status).toBe(400)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("rejects an oversized body", async () => {
    expect((await POST(new Request("http://localhost/api/plano/comprovante", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: Buffer.alloc(9 * 1024 * 1024) }))).status).toBe(413)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it("cleans up a new file when review wins the upload race", async () => {
    mocks.current.mockResolvedValue({ id: 2, status: "approved" })
    expect((await POST(upload())).status).toBe(409)
    expect(mocks.unlink).toHaveBeenCalledWith(expect.any(String))
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
