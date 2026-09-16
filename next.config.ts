import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

// 'unsafe-eval' só em dev (Turbopack/React Refresh precisam); build de
// produção não carrega isso.
const scriptSrc = ["'self'", "'unsafe-inline'", isDev && "'unsafe-eval'"].filter(Boolean).join(" ")

// 'unsafe-inline' em style-src é necessário porque a UI inteira usa
// style={{...}} do React (vira atributo style="" no HTML, que o CSP trata
// como inline style) — sem isso a tela toda perde a estilização.
const csp = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: https://img.youtube.com https://i.ytimg.com`,
  `media-src 'self'`,
  `frame-src https://www.youtube.com`,
  // youtube.com: o formulário de adicionar vídeo busca título/canal via
  // oEmbed direto do navegador (app/page.tsx). fonts.*: os <link
  // rel="preconnect"> do layout. ws://localhost só em dev — é o WebSocket
  // do Hot Module Reload do Next.js/Turbopack, sem isso o HMR fica mudo.
  `connect-src 'self' https://www.youtube.com https://fonts.googleapis.com https://fonts.gstatic.com${isDev ? " ws://localhost:* wss://localhost:*" : ""}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'self'`,
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.youtube.com" }],
    // Thumbnails do YouTube são estáveis por videoId — 7 dias no otimizador.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    // O placeholder de vídeo autoral (public/video-placeholder.svg) é SVG —
    // o next/image recusa otimizar SVG por padrão. É um asset nosso, não
    // upload de usuário, então liberar aqui é seguro; o CSP isolado abaixo
    // é a mitigação recomendada pelo próprio Next.js pra essa liberação.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/video-placeholder.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]
  },
}

export default nextConfig
