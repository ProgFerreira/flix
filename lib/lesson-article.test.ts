import { describe, expect, it } from "vitest"
import { parseLessonArticle } from "@/lib/lesson-article"

const SAMPLE = `Colocando a Mão na Massa: Instalação
Agora que entendemos o que é o Cursor e alinhamos nossas expectativas, é hora de instalar a ferramenta.

Passo a Passo da Instalação
Siga estas etapas para ter o Cursor rodando na sua máquina.

01

Download: Acesse o site oficial do Cursor (cursor.com) e clique no botão de download.

02

Instalação: Após o download, execute o arquivo baixado.

03

Primeira Abertura e Login: Ao abrir o Cursor pela primeira vez, ele pedirá para você criar uma conta.

A Tela de Boas-Vindas
Após o login, você verá a tela inicial.

Se você vir uma tela perguntando se deseja importar configurações do VS Code, você pode aceitar.

Dica de Ouro: O Cursor funciona melhor quando está focado em um projeto específico.`

describe("parseLessonArticle", () => {
  it("returns nothing for empty notes", () => {
    expect(parseLessonArticle(null)).toEqual([])
    expect(parseLessonArticle("  ")).toEqual([])
  })

  it("splits headings, paragraphs, numbered steps and the tip", () => {
    const blocks = parseLessonArticle(SAMPLE)
    expect(blocks[0]).toEqual({ type: "heading", text: "Colocando a Mão na Massa: Instalação" })
    expect(blocks[1]).toMatchObject({ type: "paragraph" })
    expect(blocks[2]).toEqual({ type: "heading", text: "Passo a Passo da Instalação" })
    expect(blocks).toContainEqual({
      type: "step",
      n: "01",
      title: "Download",
      text: "Acesse o site oficial do Cursor (cursor.com) e clique no botão de download.",
    })
    expect(blocks).toContainEqual({
      type: "step",
      n: "03",
      title: "Primeira Abertura e Login",
      text: "Ao abrir o Cursor pela primeira vez, ele pedirá para você criar uma conta.",
    })
    expect(blocks).toContainEqual({ type: "heading", text: "A Tela de Boas-Vindas" })
    expect(blocks.at(-1)).toEqual({
      type: "tip",
      text: "O Cursor funciona melhor quando está focado em um projeto específico.",
    })
  })
})
