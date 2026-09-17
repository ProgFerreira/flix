"use client"

import { signOut } from "next-auth/react"
import { logoutHref } from "@/lib/auth-redirect"

/**
 * Clears the NextAuth session, then does a full document load of login.
 * `signOut({ callbackUrl })` can land on a CDN-cached RSC payload for `/login`
 * (Hostinger strips Vary, so HTML and text/x-component share a cache key).
 */
export async function signOutToLogin() {
  const href = logoutHref()
  try {
    await signOut({ redirect: false, callbackUrl: href })
  } catch {
    // Session cookie may already be gone; still force a document load of login.
  }
  window.location.assign(href)
}
