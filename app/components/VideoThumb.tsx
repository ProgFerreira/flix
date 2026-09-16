"use client"

import Image from "next/image"

export function VideoThumb({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const url = src || "/video-placeholder.svg"
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={url.startsWith("/api/")}
      style={{ objectFit: "cover" }}
    />
  )
}
