import React from "react"

type LogoProps = {
  size?: number
}

export function Logo({ size = 22 }: LogoProps) {
  return (
    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: size, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>
      <span style={{ color: "#1E40AF" }}>GE</span><span style={{ color: "#F97316" }}>Flix</span>
    </span>
  )
}
