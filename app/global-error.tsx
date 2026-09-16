"use client"

import "./globals.css"
import "./css/app.css"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[GlobalError]", error)

  return (
    <html lang="pt-BR">
      <body>
        <div className="page">
          <div className="auth-box">
            <h1 className="page-title">Erro inesperado</h1>
            <p className="page-sub">Não foi possível carregar a página. Tente de novo.</p>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
