import Link from "next/link"
import { CourseFallback } from "./CourseFallback"

export default function CourseNotFound() {
  return (
    <CourseFallback
      message="Curso não encontrado"
      action={<Link href="/catalogo" className="btn btn-ghost">Voltar ao catálogo</Link>}
    />
  )
}
