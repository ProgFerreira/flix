export const DEFAULT_PAGE_SIZE = 24
export const MAX_PAGE_SIZE = 48
export const MANUAL_PAGE_SIZE = 200

export function parsePageParams(
  searchParams: URLSearchParams,
  fallbackSize = DEFAULT_PAGE_SIZE,
  maxSize = MAX_PAGE_SIZE,
) {
  const rawPage = Number(searchParams.get("page") ?? 1)
  const rawSize = Number(searchParams.get("limit") ?? fallbackSize)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = Number.isInteger(rawSize) && rawSize > 0
    ? Math.min(rawSize, maxSize)
    : fallbackSize
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export type Paginated<T> = ReturnType<typeof paginated<T>>

/** Aceita o envelope novo `{ items }` ou um array solto (respostas antigas). */
export function itemsFromPaginated<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items
  }
  return []
}

export function pageMeta(data: unknown): { total: number; page: number; pageCount: number } {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as { total?: unknown; page?: unknown; pageCount?: unknown; items?: unknown }
    const total = typeof d.total === "number" ? d.total : Array.isArray(d.items) ? d.items.length : 0
    const page = typeof d.page === "number" && d.page > 0 ? d.page : 1
    const pageCount = typeof d.pageCount === "number" && d.pageCount > 0 ? d.pageCount : 1
    return { total, page, pageCount }
  }
  const items = Array.isArray(data) ? data.length : 0
  return { total: items, page: 1, pageCount: 1 }
}
