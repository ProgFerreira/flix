import { describe, it, expect } from "vitest"
import { parsePageParams, paginated, itemsFromPaginated, pageMeta } from "@/lib/pagination"

describe("parsePageParams", () => {
  it("defaults to page 1 and the fallback size", () => {
    expect(parsePageParams(new URLSearchParams(), 24)).toEqual({ page: 1, pageSize: 24, skip: 0, take: 24 })
  })

  it("clamps page size to the max", () => {
    const r = parsePageParams(new URLSearchParams("page=2&limit=999"))
    expect(r.page).toBe(2)
    expect(r.pageSize).toBe(48)
    expect(r.skip).toBe(48)
  })

  it("falls back on invalid numbers", () => {
    const r = parsePageParams(new URLSearchParams("page=-3&limit=abc"))
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(24)
  })
  it("accepts a custom max size (ordem manual)", () => {
    const r = parsePageParams(new URLSearchParams("limit=200"), 200, 200)
    expect(r.pageSize).toBe(200)
  })
})

describe("paginated", () => {
  it("computes pageCount", () => {
    expect(paginated([1, 2], 50, 1, 24).pageCount).toBe(3)
    expect(paginated([], 0, 1, 24).pageCount).toBe(1)
  })
})

describe("itemsFromPaginated", () => {
  it("reads items from the envelope or a bare array", () => {
    expect(itemsFromPaginated({ items: [1, 2], total: 2, page: 1, pageSize: 24, pageCount: 1 })).toEqual([1, 2])
    expect(itemsFromPaginated([3])).toEqual([3])
    expect(itemsFromPaginated(null)).toEqual([])
  })
})

describe("pageMeta", () => {
  it("reads paging fields from the envelope", () => {
    expect(pageMeta({ items: [], total: 50, page: 2, pageCount: 3 })).toEqual({ total: 50, page: 2, pageCount: 3 })
  })
})
