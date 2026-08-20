import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getYouTubeThumbnail(videoId: string): string {
  // hqdefault sempre existe pra qualquer vídeo público; maxresdefault só
  // existe pra vídeos enviados em resolução alta o bastante — pra vídeos
  // mais antigos/menores o YouTube retorna 404 e a miniatura quebra.
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}
