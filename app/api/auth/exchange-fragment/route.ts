import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@supabase/ssr"

const BodySchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json())

    let response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })

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

    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to create session" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    return response
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Bad request" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    )
  }
}


