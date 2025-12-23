import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const BodySchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const supabase = await createSupabaseServerClient()

    // Ensure user is authenticated (invite callback must have set session cookie).
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const update: { password: string; data?: Record<string, any> } = {
      password: body.password,
    }
    if (body.fullName) {
      update.data = { full_name: body.fullName }
    }

    const { error } = await supabase.auth.updateUser(update)
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Bad request" }, { status: 400 })
  }
}


