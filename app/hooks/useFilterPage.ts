"use client"

import { useState } from "react"

/**
 * Página de listagem que volta pra 1 quando o filtro muda — sem useEffect.
 * Ajustar estado durante o render é o padrão recomendado pelo React pra
 * estado derivado (evita react-hooks/set-state-in-effect).
 */
export function useFilterPage(filterKey: string) {
  const [state, setState] = useState({ filterKey, page: 1 })
  if (state.filterKey !== filterKey) {
    setState({ filterKey, page: 1 })
  }
  const page = state.filterKey === filterKey ? state.page : 1
  const setPage = (next: number) => setState({ filterKey, page: next })
  return { page, setPage }
}
