export type LessonBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "step"; n: string; title: string; text: string }
  | { type: "tip"; text: string }

const STEP_RE = /^\d{2}$/
const TIP_RE = /^dica(?:\s+de\s+ouro)?\s*:?\s*/i
const MARKDOWN_HEADING_RE = /^#{2,3}\s+/

function isHeadingLine(line: string): boolean {
  if (MARKDOWN_HEADING_RE.test(line)) return true
  if (line.length > 80) return false
  if (/[.!?]$/.test(line)) return false
  if (STEP_RE.test(line) || TIP_RE.test(line)) return false
  return true
}

function nextNonEmpty(lines: string[], from: number): string | null {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? ""
    if (line) return line
  }
  return null
}

function splitStepBody(body: string): { title: string; text: string } {
  const cut = body.indexOf(": ")
  if (cut <= 0 || cut > 80) return { title: "", text: body }
  return { title: body.slice(0, cut).trim(), text: body.slice(cut + 2).trim() }
}

/** Interpreta notas da aula no formato da sala (títulos, passos 01/02, dica). */
export function parseLessonArticle(raw: string | null | undefined): LessonBlock[] {
  const source = raw?.trim()
  if (!source) return []

  const lines = source.split(/\r?\n/)
  const blocks: LessonBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? ""
    if (!line) {
      i += 1
      continue
    }

    if (STEP_RE.test(line)) {
      i += 1
      while (i < lines.length && !(lines[i]?.trim())) i += 1
      const body = lines[i]?.trim() ?? ""
      if (body && !STEP_RE.test(body)) {
        const { title, text } = splitStepBody(body)
        blocks.push({ type: "step", n: line, title, text: text || body })
        i += 1
      } else {
        blocks.push({ type: "step", n: line, title: "", text: "" })
      }
      continue
    }

    if (TIP_RE.test(line)) {
      blocks.push({ type: "tip", text: line.replace(TIP_RE, "").trim() || line })
      i += 1
      continue
    }

    const headingText = line.replace(MARKDOWN_HEADING_RE, "").trim()
    const upcoming = nextNonEmpty(lines, i + 1)
    const upcomingIsStepOrTip = Boolean(upcoming && (STEP_RE.test(upcoming) || TIP_RE.test(upcoming)))
    if (isHeadingLine(line) && upcoming && (upcomingIsStepOrTip || !isHeadingLine(upcoming))) {
      blocks.push({ type: "heading", text: headingText })
      i += 1
      continue
    }

    const parts: string[] = [headingText || line]
    i += 1
    while (i < lines.length) {
      const current = lines[i]?.trim() ?? ""
      if (!current) break
      if (STEP_RE.test(current) || TIP_RE.test(current) || (isHeadingLine(current) && nextNonEmpty(lines, i + 1))) break
      parts.push(current)
      i += 1
    }
    blocks.push({ type: "paragraph", text: parts.join(" ") })
  }

  return blocks
}
