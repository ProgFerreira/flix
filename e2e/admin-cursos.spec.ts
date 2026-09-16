import { test, expect, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "node:crypto"
import "dotenv/config"

const prisma = new PrismaClient()
const suffix = randomUUID()
const password = `E2e!${suffix}`
const courseTitle = `Curso E2E ${suffix}`

let admin: { id: number; email: string }
let viewer: { id: number; email: string }
let lessonA: { id: number; title: string }
let lessonB: { id: number; title: string }
let takenLesson: { id: number; title: string }

async function login(page: Page, email: string, destination: string) {
  const database = new URL(process.env.DATABASE_URL ?? "mysql://localhost")
  if (!["localhost", "127.0.0.1"].includes(database.hostname)) {
    throw new Error("Use a local test database for browser journeys")
  }
  const key = "login:ip:unknown"
  const prior = await prisma.rateLimitBucket.findUnique({ where: { chave: key } })
  await prisma.rateLimitBucket.deleteMany({ where: { chave: key } })
  try {
    await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`)
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Senha", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Entrar", exact: true }).last().click()
    await expect(page).toHaveURL(new RegExp(`${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))
  } finally {
    if (prior) {
      await prisma.rateLimitBucket.upsert({
        where: { chave: key },
        create: prior,
        update: { count: prior.count, resetAt: prior.resetAt },
      })
    } else {
      await prisma.rateLimitBucket.deleteMany({ where: { chave: key } })
    }
  }
}

test.describe.serial("Admin de cursos", () => {
  test.beforeAll(async () => {
    const hash = await bcrypt.hash(password, 10)
    admin = await prisma.user.create({
      data: {
        email: `cursos-admin-${suffix}@example.invalid`,
        password: hash,
        name: "Admin cursos",
        role: "admin",
        emailVerifiedAt: new Date(),
      },
    })
    viewer = await prisma.user.create({
      data: {
        email: `cursos-viewer-${suffix}@example.invalid`,
        password: hash,
        name: "Aluno cursos",
        plan: "premium",
        emailVerifiedAt: new Date(),
      },
    })
    lessonA = await prisma.video.create({
      data: {
        userId: admin.id,
        title: `Aula A ${suffix}`,
        videoId: "dQw4w9WgXcQ",
        source: "youtube",
        published: true,
        status: "ready",
        requiredPlan: "premium",
        thumbnail: "/video-placeholder.svg",
      },
    })
    lessonB = await prisma.video.create({
      data: {
        userId: admin.id,
        title: `Aula B ${suffix}`,
        videoId: "oHg5SJYRHA0",
        source: "youtube",
        published: true,
        status: "ready",
        requiredPlan: "premium",
        thumbnail: "/video-placeholder.svg",
      },
    })
    takenLesson = await prisma.video.create({
      data: {
        userId: admin.id,
        title: `Aula de outro curso ${suffix}`,
        videoId: "9bZkp7q19f0",
        source: "youtube",
        published: true,
        status: "ready",
        requiredPlan: "free",
        thumbnail: "/video-placeholder.svg",
      },
    })
    await prisma.course.create({
      data: {
        title: `Outro curso ${suffix}`,
        slug: `outro-curso-${suffix}`,
        published: false,
        modules: {
          create: {
            title: "Ocupado",
            sortOrder: 0,
            lessons: { create: { videoId: takenLesson.id, sortOrder: 0 } },
          },
        },
      },
    })
  })

  test.afterAll(async () => {
    const ids = [admin?.id, viewer?.id].filter(Boolean) as number[]
    await prisma.$transaction(async (tx) => {
      await tx.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } })
      await tx.course.deleteMany({ where: { title: { contains: suffix } } })
      await tx.video.deleteMany({ where: { userId: { in: ids } } })
      await tx.user.deleteMany({ where: { id: { in: ids } } })
    })
    await prisma.$disconnect()
  })

  test("sem sessão, o editor redireciona para o login", async ({ page }) => {
    await page.goto("/admin/cursos/3")
    await expect(page).toHaveURL(/\/login/)
  })

  test("usuário comum não entra em /admin/cursos", async ({ page }) => {
    await login(page, viewer.email, "/")
    await page.goto("/admin/cursos")
    await expect(page).toHaveURL(/\/$/)
  })

  test("curso inexistente mostra aviso no editor", async ({ page }) => {
    await login(page, admin.email, "/admin/cursos/999999001")
    await expect(page.getByText("Curso não encontrado")).toBeVisible()
  })

  test("admin cria, monta a trilha, publica, o aluno assiste e a exclusão mantém as aulas", async ({ page }) => {
    test.setTimeout(120_000)
    await login(page, admin.email, "/admin/cursos")
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible()

    await page.getByRole("button", { name: "Novo curso" }).click()
    await page.getByRole("textbox", { name: "Título" }).fill(courseTitle)
    await page.getByRole("button", { name: "Criar e montar trilha" }).click()

    await expect(page).toHaveURL(/\/admin\/cursos\/\d+$/)
    await expect(page.getByRole("heading", { name: "Editar curso" })).toBeVisible()
    await expect(page.getByText("Nenhum módulo ainda")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue(courseTitle)

    await page.getByRole("textbox", { name: "Descrição" }).fill("Trilha montada no teste E2E")
    await page.getByRole("textbox", { name: "O que o aluno vai aprender" }).fill("Cortar tecidos\nCosturar peças")
    await page.getByLabel("Plano mínimo").selectOption("premium")

    await page.getByRole("button", { name: "Adicionar módulo" }).click()
    await page.getByRole("button", { name: "Adicionar módulo" }).click()
    await page.getByRole("textbox", { name: "Título do módulo 1" }).fill("Fundamentos")
    await page.getByRole("textbox", { name: "Título do módulo 2" }).fill("Avançado")

    await page.getByRole("button", { name: "Descer módulo" }).first().click()
    await expect(page.getByRole("textbox", { name: "Título do módulo 1" })).toHaveValue("Avançado")
    await expect(page.getByRole("textbox", { name: "Título do módulo 2" })).toHaveValue("Fundamentos")
    await page.getByRole("button", { name: "Subir módulo" }).nth(1).click()
    await expect(page.getByRole("textbox", { name: "Título do módulo 1" })).toHaveValue("Fundamentos")

    await page.getByRole("button", { name: "Adicionar aula" }).first().click()
    await expect(page.getByRole("button", { name: `Incluir ${takenLesson.title}` })).toHaveCount(0)
    await expect(page.getByRole("button", { name: `Incluir ${lessonA.title}` })).toBeVisible()
    await page.getByRole("button", { name: `Incluir ${lessonA.title}` }).click()
    await expect(page.getByText(lessonA.title, { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Adicionar aula" }).first().click()
    await page.getByLabel("Buscar aula do catálogo").fill("zzzz-sem-aula")
    await expect(page.getByText("Nenhuma aula disponível. Envie em Vídeos autorais.")).toBeVisible()
    await page.getByRole("button", { name: "Fechar busca" }).click()

    await page.getByRole("button", { name: "Adicionar aula" }).nth(1).click()
    await expect(page.getByRole("button", { name: `Incluir ${lessonA.title}` })).toHaveCount(0)
    await page.getByRole("button", { name: `Incluir ${lessonB.title}` }).click()

    await page.getByLabel("Publicado no catálogo").check()
    await page.getByRole("button", { name: "Salvar curso" }).click()

    await expect.poll(async () => {
      const row = await prisma.course.findFirst({
        where: { title: courseTitle },
        include: { modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } } },
      })
      if (!row?.published) return null
      return {
        plan: row.requiredPlan,
        description: row.description,
        learnings: row.learnings,
        modules: row.modules.map((module) => ({
          title: module.title,
          videos: module.lessons.map((lesson) => lesson.videoId),
        })),
      }
    }).toEqual({
      plan: "premium",
      description: "Trilha montada no teste E2E",
      learnings: "Cortar tecidos\nCosturar peças",
      modules: [
        { title: "Fundamentos", videos: [lessonA.id] },
        { title: "Avançado", videos: [lessonB.id] },
      ],
    })

    const course = await prisma.course.findFirstOrThrow({ where: { title: courseTitle } })

    await page.getByRole("button", { name: "Cursos" }).click()
    await expect(page).toHaveURL(/\/admin\/cursos$/)
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
    await expect(page.getByText("2 aulas em 2 módulos")).toBeVisible()
    await expect(page.getByText("Publicado")).toBeVisible()

    await page.getByRole("button", { name: "Sair", exact: true }).click()
    await login(page, viewer.email, `/catalogo/cursos/${course.slug}`)
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
    await expect(page.getByRole("heading", { name: "O que você vai aprender" })).toBeVisible()
    await expect(page.getByText("Cortar tecidos")).toBeVisible()
    await expect(page.getByRole("button", { name: "1. Fundamentos" })).toBeVisible()
    await page.getByRole("link", { name: "Iniciar curso" }).click()
    await expect(page).toHaveURL(new RegExp(`/catalogo/cursos/${course.slug}\\?aula=${lessonA.id}$`))
    await expect(page.getByRole("heading", { name: lessonA.title })).toBeVisible()
    await expect(page.getByRole("button", { name: "Próxima aula" })).toBeVisible()
    await page.getByRole("button", { name: "Próxima aula" }).click()
    await expect(page.getByRole("heading", { name: lessonB.title })).toBeVisible()

    await page.getByRole("link", { name: "Voltar ao curso" }).click()
    await expect(page).toHaveURL(new RegExp(`/catalogo/cursos/${course.slug}$`))
    await expect(page.getByRole("heading", { name: courseTitle })).toBeVisible()
    await page.getByRole("link", { name: "Voltar ao catálogo" }).click()
    await page.getByRole("button", { name: "Sair", exact: true }).click()
    await login(page, admin.email, `/admin/cursos/${course.id}`)
    await page.getByRole("link", { name: "Pré-visualizar" }).click()
    await expect(page.getByText("Você está no modo de pré-visualização.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Iniciar curso" })).toBeVisible()
    await page.getByRole("link", { name: "Iniciar curso" }).click()
    await expect(page).toHaveURL(new RegExp(`/catalogo/cursos/${course.slug}\\?aula=${lessonA.id}&preview=1$`))
    await page.getByRole("link", { name: "Fechar pré-visualização" }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/cursos/${course.id}`))
    await page.getByRole("button", { name: "Excluir", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Excluir", exact: true }).click()
    await page.getByRole("button", { name: "Excluir curso" }).click()
    await expect(page).toHaveURL(/\/admin\/cursos$/)
    await expect(page.getByRole("link", { name: courseTitle })).toHaveCount(0)

    expect(await prisma.course.findUnique({ where: { id: course.id } })).toBeNull()
    expect(await prisma.video.findUnique({ where: { id: lessonA.id } })).toBeTruthy()
    expect(await prisma.video.findUnique({ where: { id: lessonB.id } })).toBeTruthy()
  })
})
