import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

const BodySchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  homeRegion: z.string().max(20).optional(),
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
    
    // Build user_metadata with optional fields
    const metadata: Record<string, any> = {}
    if (body.fullName) metadata.full_name = body.fullName
    if (body.homeRegion) metadata.home_region = body.homeRegion
    
    // Check allowed_emails for api_access flag
    const userEmail = userData.user.email
    if (userEmail) {
      const admin = createSupabaseAdminClient()
      const { data: allowedRow } = await admin
        .from("allowed_emails")
        .select("api_access")
        .ilike("email", userEmail)
        .single()
      
      // If api_access is explicitly false, set it in user metadata
      if (allowedRow?.api_access === false) {
        metadata.api_access = false
      }
    }
    
    if (Object.keys(metadata).length > 0) {
      update.data = metadata
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


