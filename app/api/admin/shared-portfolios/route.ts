import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/require-admin"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/** Generate a URL-safe slug from a name, with a short random suffix */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
  const suffix = Math.random().toString(36).slice(2, 6)
  return base ? `${base}-${suffix}` : suffix
}

// POST — Create a shared portfolio
export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin()
  if (!user) return response!

  try {
    const body = await request.json()
    const { name, assetSlugs, logoDomain } = body as {
      name?: string
      assetSlugs?: string[]
      logoDomain?: string
    }

    if (!assetSlugs || assetSlugs.length === 0) {
      return NextResponse.json(
        { error: "At least one asset slug is required" },
        { status: 400 }
      )
    }

    const portfolioName = name?.trim() || `Portfolio ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
    const slug = slugify(portfolioName)

    const supabase = createSupabaseAdminClient()

    const { data, error } = await supabase
      .from("shared_portfolios")
      .insert({
        slug,
        name: portfolioName,
        logo_domain: logoDomain?.trim() || null,
        asset_slugs: assetSlugs,
      })
      .select("id, slug, name, logo_domain, asset_slugs, created_at")
      .single()

    if (error) {
      console.error("Failed to create shared portfolio:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const origin =
      request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}`
        : request.headers.get("origin") ?? ""
    const url = `${origin}/p/${data.slug}`

    return NextResponse.json({ ...data, url }, { status: 201 })
  } catch (err) {
    console.error("Invalid request body:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

// GET — List all shared portfolios
export async function GET() {
  const { user, response } = await requireAdmin()
  if (!user) return response!

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from("shared_portfolios")
    .select("id, slug, name, logo_domain, asset_slugs, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Failed to list shared portfolios:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ portfolios: data })
}
