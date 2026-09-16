"use client"

import { useState } from "react"
import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PlayerProvider } from "@/app/contexts/PlayerContext"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient)
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <PlayerProvider>
          {children}
        </PlayerProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
