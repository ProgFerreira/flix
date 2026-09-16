"use client"

type Props = {
  page: number
  pageCount: number
  total: number
  onPage: (page: number) => void
}

export function Pager({ page, pageCount, total, onPage }: Props) {
  if (total <= 0 || pageCount <= 1) return null
  return (
    <nav className="pager" aria-label="Paginação">
      <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        Anterior
      </button>
      <p className="pager-status">
        Página {page} de {pageCount} · {total} item{total === 1 ? "" : "s"}
      </p>
      <button type="button" className="btn btn-ghost" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Próxima página">
        Próxima
      </button>
    </nav>
  )
}
