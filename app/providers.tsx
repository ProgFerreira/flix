"use client"

import { SessionProvider } from "next-auth/react"
import { PlayerProvider } from "@/app/contexts/PlayerContext"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PlayerProvider>
        {children}
      </PlayerProvider>
    </SessionProvider>
  )
}
