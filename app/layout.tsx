import type { Metadata } from "next"
import "./globals.css"
import "./css/app.css"
import "./css/ux.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "GEFlix — Gestão de Vídeos",
  description: "Organize seus vídeos favoritos, compartilhe coleções e descubra conteúdos exclusivos. Comece gratuitamente.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1E40AF" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
