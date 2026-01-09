import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import crypto from "crypto"

function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex")
}

// GET: List user's API keys (metadata only, no hashes)
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, partner_name, environment, scopes, created_at, last_used_at, is_active")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ keys: keys || [] })
}

// POST: Create a new API key (returns plaintext ONCE)
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const name = (body.name || "My API Key").slice(0, 100)
  const environment = body.environment === "sandbox" ? "sandbox" : "production"
  
  // Generate secure random key with prefix
  const prefix = environment === "production" ? "riq_live_" : "riq_test_"
  const plaintext = prefix + crypto.randomBytes(24).toString("hex")
  const hash = sha256(plaintext)

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      key_hash: hash,
      partner_name: name,
      contact_email: user.email,
      environment,
      scopes: ["read:observations"],
      rate_limit_rpm: 60,
      rate_limit_rpd: 10000,
      is_active: true,
    })
    .select("id, partner_name, environment, scopes, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return plaintext ONCE - never stored, never returned again
  return NextResponse.json({
    key: plaintext,
    ...data,
  })
}

// DELETE: Revoke an API key
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get("id")
  
  if (!keyId) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 })
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("user_id", user.id) // RLS also enforces this

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

