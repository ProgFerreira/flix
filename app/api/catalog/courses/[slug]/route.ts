import { NextRequest, NextResponse } from "next/server"
import { loadPublicCourseBySlug } from "@/lib/load-public-course"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const course = await loadPublicCourseBySlug((await params).slug)
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 })
  return NextResponse.json(course)
}
