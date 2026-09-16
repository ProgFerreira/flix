"use client"

import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener("flix:url", callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener("flix:url", callback)
  }
}

/** URL-backed filters with a stable server snapshot and browser back support. */
export function useUrlState<T>(key: string, fallback: T, parse: (value: string) => T) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "")
  const raw = new URLSearchParams(search).get(key)
  const value = raw === null ? fallback : parse(raw)
  const setValue = (next: T) => {
    const url = new URL(window.location.href)
    if (Object.is(next, fallback)) url.searchParams.delete(key)
    else url.searchParams.set(key, String(next))
    if (key !== "page") url.searchParams.delete("page")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    window.dispatchEvent(new Event("flix:url"))
  }
  return [value, setValue] as const
}
