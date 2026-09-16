import { describe, it, expect } from "vitest"
import { csvEscape, toCsv } from "@/lib/csv"

describe("csvEscape", () => {
  it("leaves simple values alone", () => {
    expect(csvEscape("abc")).toBe("abc")
    expect(csvEscape(12)).toBe("12")
    expect(csvEscape(null)).toBe("")
  })

  it("quotes commas and doubles quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"')
    expect(csvEscape('diz "oi"')).toBe('"diz ""oi"""')
  })
})

describe("toCsv", () => {
  it("adds a BOM and CRLF rows", () => {
    const csv = toCsv(["a", "b"], [["1", "x,y"]])
    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(csv).toContain("a,b")
    expect(csv).toContain('"x,y"')
  })
})
