import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return NextResponse.json({ user: data.user ?? null })
}


