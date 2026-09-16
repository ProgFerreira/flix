"use client"

import { PageError } from "@/app/components/RouteFallback"

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <PageError reset={reset} />
}
