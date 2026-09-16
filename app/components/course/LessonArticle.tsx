"use client"

import { parseLessonArticle, type LessonBlock } from "@/lib/lesson-article"

function Text({ value }: { value: string }) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

function Block({ block }: { block: LessonBlock }) {
  if (block.type === "heading") {
    return <h2 className="lesson-article-title">{block.text}</h2>
  }
  if (block.type === "paragraph") {
    return <p className="lesson-article-p"><Text value={block.text} /></p>
  }
  if (block.type === "tip") {
    return (
      <aside className="lesson-article-tip">
        <strong>Dica de Ouro:</strong> <Text value={block.text} />
      </aside>
    )
  }
  return (
    <div className="lesson-article-step">
      <span className="lesson-article-step-n">{block.n}</span>
      <div>
        {block.title ? <p className="lesson-article-step-title">{block.title}</p> : null}
        {block.text ? <p className="lesson-article-p"><Text value={block.text} /></p> : null}
      </div>
    </div>
  )
}

export function LessonArticle({ notes }: { notes: string | null }) {
  const blocks = parseLessonArticle(notes)
  if (blocks.length === 0) return null
  return (
    <div className="lesson-article">
      {blocks.map((block, index) => <Block key={`${block.type}-${index}`} block={block} />)}
    </div>
  )
}
