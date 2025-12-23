import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const url = request.nextUrl

  const code = url.searchParams.get("code")
  const token_hash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as any

  const returnTo = url.searchParams.get("returnTo") || "/dashboard"
  const redirectTo = new URL("/invite", url.origin)
  redirectTo.searchParams.set("returnTo", returnTo)

  let response = NextResponse.redirect(redirectTo)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } else if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type })
      if (error) throw error
    } else {
      // No recognizable auth params. Send to invite page; it will show an error.
    }
  } catch (e: any) {
    const errRedirect = new URL("/invite", url.origin)
    errRedirect.searchParams.set("returnTo", returnTo)
    errRedirect.searchParams.set("error", e?.message || "Invalid or expired link")
    response = NextResponse.redirect(errRedirect)
  }

  return response
}


