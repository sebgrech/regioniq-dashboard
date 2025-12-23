"use client"

import { useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function parseHash(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash
  const params = new URLSearchParams(h)
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    type: params.get("type"),
    expires_in: params.get("expires_in"),
  }
}

export default function AuthFragmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const returnTo = useMemo(() => searchParams.get("returnTo") || "/dashboard", [searchParams])

  useEffect(() => {
    const { access_token, refresh_token } = parseHash(window.location.hash)

    if (!access_token || !refresh_token) {
      router.replace(
        `/invite?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent(
          "Missing auth tokens"
        )}`
      )
      return
    }

    ;(async () => {
      const res = await fetch("/api/auth/exchange-fragment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        router.replace(
          `/invite?returnTo=${encodeURIComponent(returnTo)}&error=${encodeURIComponent(
            payload?.error || "Failed to create session"
          )}`
        )
        return
      }

      router.replace(`/invite?returnTo=${encodeURIComponent(returnTo)}`)
      router.refresh()
    })()
  }, [router, returnTo])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </div>
  )
}


