import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

const BodySchema = z.object({
  email: z.string().email("Invalid email address"),
  homeRegion: z.string().max(20).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const email = body.email.toLowerCase().trim()

    const admin = createSupabaseAdminClient()

    // Check if email is in the allowlist
    const { data: allowed, error: lookupError } = await admin
      .from("allowed_emails")
      .select("email")
      .ilike("email", email)
      .single()

    if (lookupError || !allowed) {
      return NextResponse.json(
        { error: "No account found for this email. Contact us for access." },
        { status: 403 }
      )
    }

    // Email is in allowlist - send magic link via signInWithOtp
    // This uses the anon key client which properly triggers Supabase's email sending
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        shouldCreateUser: true, // Create user on first magic link click
      },
    })

    if (otpError) {
      console.error("Failed to send magic link:", otpError)
      return NextResponse.json(
        { error: "Failed to send access link. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Access link sent to your email.",
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Invalid request" },
        { status: 400 }
      )
    }
    console.error("Request access error:", err)
    return NextResponse.json(
      { error: err?.message || "Something went wrong" },
      { status: 400 }
    )
  }
}
