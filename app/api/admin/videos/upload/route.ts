import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import fs from "fs/promises"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { validateUpload, generateStoredFilename, resolveStoredFilePath, ensureStorageDir } from "@/lib/video-storage"

export const runtime = "nodejs"

const metaSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  channelName: z.string().optional(),
  notes: z.string().optional(),
  requiredPlan: z.enum(["free", "premium", "pro"]).default("free"),
  published: z.enum(["true", "false"]).default("false"),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo de vídeo obrigatório" }, { status: 400 })
  }

  const parsed = metaSchema.safeParse({
    title: form.get("title"),
    channelName: form.get("channelName") ?? undefined,
    notes: form.get("notes") ?? undefined,
    requiredPlan: form.get("requiredPlan") ?? "free",
    published: form.get("published") ?? "false",
  })
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  let categoryIds: number[] = []
  const categoryIdsRaw = form.get("categoryIds")
  if (typeof categoryIdsRaw === "string" && categoryIdsRaw.length > 0) {
    try {
      const arr = JSON.parse(categoryIdsRaw)
      if (Array.isArray(arr) && arr.every((v) => typeof v === "number")) categoryIds = arr
    } catch {
      return NextResponse.json({ error: "categoryIds inválido" }, { status: 400 })
    }
  }

  const validation = validateUpload({ mimeType: file.type, size: file.size })
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  ensureStorageDir()
  const filename = generateStoredFilename(file.type)
  const absolutePath = resolveStoredFilePath(filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(absolutePath, buffer)

  const { title, channelName, notes, requiredPlan, published } = parsed.data

  const video = await prisma.video.create({
    data: {
      userId,
      title,
      channelName,
      notes,
      thumbnail: "/video-placeholder.svg",
      source: "upload",
      filePath: filename,
      mimeType: file.type,
      fileSize: file.size,
      status: "ready",
      published: published === "true",
      requiredPlan,
      videoCategories: categoryIds.length ? { create: categoryIds.map((cid) => ({ categoryId: cid })) } : undefined,
    },
    include: { videoCategories: { include: { category: true } } },
  })

  return NextResponse.json(video)
}
