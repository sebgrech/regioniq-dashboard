import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }

  return NextResponse.json(
    {
      access_token: data.session.access_token,
      token_type: "bearer",
      expires_at: data.session.expires_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}


