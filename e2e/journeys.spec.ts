import { test, expect, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdir, unlink } from "node:fs/promises"
import path from "node:path"
import "dotenv/config"

const prisma = new PrismaClient()
const suffix = randomUUID()
const password = `E2e!${suffix}`
let viewer: { id: number; email: string }
let admin: { id: number; email: string }
let video: { id: number; title: string }
let requestId: number
let signupUser: { id: number; email: string } | undefined
const uploadTitle = `Upload UX ${suffix}`

async function login(page: Page, email: string, destination: string) {
  // The local dev server has no proxy: test logins share the "unknown" bucket.
  // Preserve and restore it so serial journey runs do not consume the user's quota.
  const database = new URL(process.env.DATABASE_URL ?? "mysql://localhost")
  if (!["localhost", "127.0.0.1"].includes(database.hostname)) throw new Error("Use a local test database for browser journeys")
  const key = "login:ip:unknown"
  const prior = await prisma.rateLimitBucket.findUnique({ where: { chave: key } })
  await prisma.rateLimitBucket.deleteMany({ where: { chave: key } })
  try {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Senha", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click()
  await expect(page).toHaveURL(new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"))
  } finally {
    if (prior) await prisma.rateLimitBucket.upsert({ where: { chave: key }, create: prior, update: { count: prior.count, resetAt: prior.resetAt } })
    else await prisma.rateLimitBucket.deleteMany({ where: { chave: key } })
  }
}

test.describe.serial("Critical user journeys", () => {
  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    viewer = await prisma.user.create({ data: { email: `ux-viewer-${suffix}@example.invalid`, password: hash, name: "Teste de experiência", emailVerifiedAt: new Date() } })
    admin = await prisma.user.create({ data: { email: `ux-admin-${suffix}@example.invalid`, password: hash, name: "Teste de gestão", role: "admin", emailVerifiedAt: new Date() } })
    video = await prisma.video.create({ data: { userId: admin.id, title: `Vídeo UX ${suffix}`, videoId: "dQw4w9WgXcQ", source: "youtube", published: true, status: "ready", requiredPlan: "premium", thumbnail: "/video-placeholder.svg" } })
  })

  test.afterAll(async () => {
    const ids = [viewer?.id, admin?.id, signupUser?.id].filter(Boolean) as number[]
    const receipts = await prisma.planChangeRequest.findMany({ where: { userId: { in: ids } }, select: { receiptPath: true } })
    const uploads = await prisma.video.findMany({
      where: { userId: { in: ids }, source: "upload" },
      select: { filePath: true, previewPath: true, playbackPath: true, thumbPath: true },
    })
    await prisma.$transaction(async tx => {
      await tx.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } })
      await tx.planPayment.deleteMany({ where: { userId: { in: ids } } })
      await tx.planChangeRequest.deleteMany({ where: { userId: { in: ids } } })
      await tx.subscription.deleteMany({ where: { userId: { in: ids } } })
      await tx.course.deleteMany({ where: { title: { contains: suffix } } })
      await tx.course.deleteMany({
        where: { modules: { some: { lessons: { some: { video: { userId: { in: ids } } } } } } },
      })
      await tx.video.deleteMany({ where: { userId: { in: ids } } })
      await tx.user.deleteMany({ where: { id: { in: ids } } })
    })
    for (const row of receipts) if (row.receiptPath) await unlink(path.join(process.cwd(), "storage", "receipts", path.basename(row.receiptPath))).catch(() => {})
    for (const row of uploads) {
      for (const file of [row.filePath, row.previewPath, row.playbackPath]) {
        if (file) await unlink(path.join(process.cwd(), "storage", "videos", path.basename(file))).catch(() => {})
      }
      if (row.thumbPath) await unlink(path.join(process.cwd(), "storage", "thumbs", path.basename(row.thumbPath))).catch(() => {})
    }
    await prisma.$disconnect()
  })

  test("visitor registration opens signup and fits desktop/mobile", async ({ page }) => {
    await page.goto("/catalogo")
    await page.getByRole("link", { name: "Criar conta", exact: true }).click()
    await expect(page.getByLabel("Nome", { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/mode=register/)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/signup-${width}.png`, fullPage: true, animations: "disabled" })
    }
    await page.getByRole("button", { name: "Mostrar senha" }).click()
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text")
  })

  test("visitor can create an account", async ({ page }) => {
    const email = `ux-signup-${suffix}@example.invalid`
    await prisma.rateLimitBucket.deleteMany({ where: { chave: { startsWith: "signup:" } } })
    await page.goto("/login")
    await page.getByRole("tab", { name: "Cadastrar", exact: true }).click()
    await page.getByLabel("Nome", { exact: true }).fill("Cadastro E2E")
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Senha", { exact: true }).fill(password)
    await page.locator("#signup-terms").check()
    await page.getByRole("button", { name: "Criar conta", exact: true }).click()
    await expect(page).not.toHaveURL(/\/login/)
    const created = await prisma.user.findUniqueOrThrow({ where: { email } })
    signupUser = { id: created.id, email: created.email }
    expect(created.name).toBe("Cadastro E2E")
  })

  test("login returns to the selected locked video and filters survive reload", async ({ page }) => {
    await login(page, viewer.email, `/catalogo?video=${video.id}`)
    await expect(page.getByRole("heading", { name: video.title })).toBeVisible()
    await expect(page.getByRole("link", { name: "Assinar Premium" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toHaveCount(0)
    await expect(page.getByLabel("O que o GEFlix faz")).toHaveCount(0)
    await page.getByRole("button", { name: "Ver todo o catálogo" }).click()
    await page.getByRole("button", { name: "Premium", exact: true }).click()
    await page.reload()
    await expect(page.getByRole("button", { name: "Premium", exact: true })).toHaveClass(/is-active/)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: "test-results/catalog-mobile.png", fullPage: true, animations: "disabled" })
  })

  test("plan selection, accessible modal and receipt upload", async ({ page }) => {
    await login(page, viewer.email, "/plano")
    const trigger = page.getByRole("button", { name: "Solicitar Premium", exact: true })
    await trigger.click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.getByRole("button", { name: "Enviar solicitação" }).click()
    await expect(page.getByRole("heading", { name: /Pedido #/ })).toBeVisible()
    const pending = await prisma.planChangeRequest.findFirstOrThrow({ where: { userId: viewer.id, status: "pending" } })
    requestId = pending.id
    await page.getByLabel("Comprovante de pagamento", { exact: true }).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nUX test receipt\n%%EOF") })
    await page.getByRole("button", { name: "Enviar comprovante", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Comprovante recebido", exact: true })).toBeVisible()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).plan).toBe("free")
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await page.screenshot({ path: "test-results/plan-receipt.png", fullPage: true, animations: "disabled" })
    const other = await page.request.get(`/api/plano/comprovante?id=${requestId + 100000}`)
    expect(other.status()).toBe(404)
  })

  test("admin can review receipt and approve, viewer gains access", async ({ page }) => {
    await login(page, admin.email, "/admin/solicitacoes")
    const download = await page.request.get(`/api/plano/comprovante?id=${requestId}`)
    expect(download.status()).toBe(200)
    expect(download.headers()["cache-control"]).toContain("no-store")
    const row = page.getByRole("row").filter({ hasText: viewer.email })
    await row.getByRole("button", { name: "Aprovar", exact: true }).click()
    await page.getByRole("button", { name: /Confirmar aprovação/ }).click()
    await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } })).plan).toBe("premium")
    await page.screenshot({ path: "test-results/admin-desktop.png", fullPage: true, animations: "disabled" })
    await page.getByRole("button", { name: "Sair", exact: true }).click()
    await login(page, viewer.email, `/catalogo?video=${video.id}`)
    await expect(page.getByRole("button", { name: `Assistir ${video.title}` })).toBeVisible()
    await expect(page.getByRole("link", { name: "Assinar Premium" })).toHaveCount(0)
  })
  test("library filters and publication network errors preserve context", async ({ page }) => {
    await login(page, viewer.email, "/")
    await page.getByLabel("Buscar vídeos", { exact: true }).fill("coleção")
    await page.getByLabel("Ordenar", { exact: true }).selectOption("az")
    await page.reload()
    await expect(page.getByLabel("Buscar vídeos", { exact: true })).toHaveValue("coleção")
    await expect(page.getByLabel("Ordenar", { exact: true })).toHaveValue("az")
    await page.getByRole("button", { name: "Sair", exact: true }).click()
    await login(page, admin.email, "/catalogo")
    await page.getByRole("button", { name: "Publicar", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("tab", { name: "Link", exact: true }).click()
    await page.route("https://www.youtube.com/oembed**", route => route.abort())
    await page.getByLabel("URL do YouTube").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    await page.getByLabel("Título", { exact: true }).fill("Rascunho preservado")
    await page.route("**/api/catalog", route => route.request().method() === "POST" ? route.abort() : route.continue())
    await page.getByRole("dialog").getByRole("button", { name: /Publicar link/ }).click()
    await expect(page.getByText("Não foi possível conectar. Seus dados foram mantidos; tente novamente.")).toBeVisible()
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Rascunho preservado")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("admin can upload a video that becomes ready", async ({ page }) => {
    test.setTimeout(180_000)
    const ffmpeg = process.env.FFMPEG_PATH?.trim() || "C:\\ffmpeg\\bin\\ffmpeg.exe"
    const fixture = path.join(process.cwd(), "test-results", `sample-${suffix}.mp4`)
    await mkdir(path.dirname(fixture), { recursive: true })
    execFileSync(ffmpeg, [
      "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", fixture,
    ], { windowsHide: true })
    await login(page, admin.email, "/catalogo")
    await page.getByRole("button", { name: "Publicar", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("tab", { name: "Arquivo", exact: true }).click()
    await page.locator("#publish-video-file").setInputFiles(fixture)
    await page.getByLabel("Título", { exact: true }).fill(uploadTitle)
    await page.getByRole("button", { name: "Enviar vídeo", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60_000 })
    await expect.poll(async () => {
      const row = await prisma.video.findFirst({ where: { userId: admin.id, title: uploadTitle } })
      return row?.status ?? null
    }, { timeout: 120_000 }).toBe("ready")
    await page.reload()
    await expect(page.getByRole("heading", { name: uploadTitle })).toBeVisible()
    await unlink(fixture).catch(() => {})
  })

  test("admin can assemble a course that subscribers can open", async ({ page }) => {
    const courseTitle = `Curso UX ${suffix}`
    await login(page, admin.email, "/admin/cursos")
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible()
    await page.getByRole("button", { name: "Novo curso" }).click()
    await page.getByRole("textbox", { name: "Título" }).fill(courseTitle)
    await page.getByRole("button", { name: "Criar e montar trilha" }).click()
    await expect(page.getByRole("heading", { name: "Editar curso" })).toBeVisible()
    await page.getByRole("button", { name: "Adicionar módulo" }).click()
    await page.getByRole("button", { name: "Adicionar aula" }).click()
    await page.getByRole("tab", { name: "Já enviado" }).click()
    await expect(page.getByRole("dialog").getByRole("button", { name: video.title })).toBeVisible()
    await page.getByRole("dialog").getByRole("button", { name: video.title }).click()
    await expect(page.getByText(video.title, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Adicionar aula" }).click()
    await page.getByRole("tab", { name: "Já enviado" }).click()
    await expect(page.getByRole("dialog").getByRole("button", { name: uploadTitle })).toBeVisible()
    await page.getByRole("dialog").getByRole("button", { name: uploadTitle }).click()
    await page.getByRole("button", { name: /^Publicado/ }).click()
    await page.getByRole("button", { name: "Salvar curso" }).click()
    await expect.poll(async () => {
      const row = await prisma.course.findFirst({
        where: { title: courseTitle },
        include: { modules: { include: { lessons: true } } },
      })
      if (!row?.published) return 0
      return row.modules.reduce((n, module) => n + module.lessons.length, 0)
    }).toBe(2)
    const course = await prisma.course.findFirstOrThrow({ where: { title: courseTitle } })

    await page.getByRole("button", { name: "Sair", exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible()
    await expect(page.locator("body")).not.toContainText(":HL[")
    await page.goto("/catalogo")
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
    await expect(page.getByRole("heading", { name: uploadTitle })).toHaveCount(0)

    await login(page, viewer.email, `/catalogo/cursos/${course.slug}`)
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
    await expect(page.getByText("Carregando...", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Iniciar curso" })).toBeVisible()
    await page.getByRole("link", { name: "Iniciar curso" }).click()
    await expect(page).toHaveURL(new RegExp(`/catalogo/cursos/${course.slug}\\?aula=`))
    await expect(page.getByRole("button", { name: `Assistir ${video.title}` })).toBeVisible()
    await page.getByRole("button", { name: `Assistir ${video.title}` }).click()
    await expect(page.getByRole("button", { name: "Próxima aula" })).toBeVisible()
    await page.getByRole("link", { name: "Voltar ao curso" }).click()
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
  })

  test("admin operations render and navigation fits mobile", async ({ page }) => {
    await login(page, admin.email, "/admin")
    await expect(page.getByText("Espaço livre no servidor", { exact: true })).toBeVisible({ timeout: 25000 })
    await expect(page.getByText("Processador de vídeos")).toBeVisible()
    await expect(page.getByText("Disponível", { exact: true })).toBeVisible()
    await expect(page.getByText("Ainda sem registro")).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: "test-results/admin-mobile.png", fullPage: true, animations: "disabled" })
  })

})
