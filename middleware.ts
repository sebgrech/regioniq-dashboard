import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
            // Also update the request cookies so subsequent middleware/routes see them
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session + get user (also updates cookies on response via setAll).
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    const authCookies = request.cookies.getAll().filter(c => c.name.includes("auth") || c.name.includes("supabase"))
    console.log(`[Middleware] ${request.nextUrl.pathname} | User: ${user?.email ?? "NONE"} | Cookies: ${authCookies.length} | Error: ${error?.message ?? "none"}`)
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/compare/:path*",
    "/catchment/:path*",
    "/data/:path*",
    "/metric/:path*",
    "/analysis/:path*",
    "/admin/:path*",
    "/developers/:path*",
    "/portfolio/:path*",
  ],
}


