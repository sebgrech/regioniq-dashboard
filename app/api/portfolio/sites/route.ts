import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

// =============================================================================
// Portfolio Sites API — per-user CRUD for site evaluations
// =============================================================================

/** Generate a URL-safe slug from site name or address */
function generateSlug(siteName: string, address: string): string {
  const base = siteName || address
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

// =============================================================================
// GET — List user's portfolio sites
// =============================================================================

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: sites, error } = await supabase
    .from("site_evaluations")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch portfolio sites:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sites })
}

// =============================================================================
// POST — Add a new site to user's portfolio
// =============================================================================

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      address,
      postcode,
      region_code,
      region_name,
      site_name,
      headline,
      brand,
      brand_logo_url,
      asset_class,
      sq_ft,
      lat,
      lng,
      notes,
    } = body

    // Validate required fields
    if (!address?.trim()) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 })
    }
    if (!region_code || !region_name) {
      return NextResponse.json(
        { error: "Region code and name are required. Please lookup a postcode first." },
        { status: 400 }
      )
    }

    const slug = generateSlug(site_name || "", address)

    const { data: site, error } = await supabase
      .from("site_evaluations")
      .insert({
        slug,
        address: address.trim(),
        postcode: postcode?.trim() || null,
        region_code,
        region_name,
        site_name: site_name?.trim() || null,
        headline: headline?.trim() || null,
        brand: brand?.trim() || null,
        brand_logo_url: brand_logo_url?.trim() || null,
        asset_class: asset_class || null,
        sq_ft: sq_ft ? parseInt(String(sq_ft), 10) : null,
        lat: lat ?? null,
        lng: lng ?? null,
        notes: notes?.trim() || null,
        user_id: user.id,
        status: "active",
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation — try appending a random suffix
        const suffixedSlug = `${slug}-${Date.now().toString(36)}`
        const { data: retryData, error: retryError } = await supabase
          .from("site_evaluations")
          .insert({
            slug: suffixedSlug,
            address: address.trim(),
            postcode: postcode?.trim() || null,
            region_code,
            region_name,
            site_name: site_name?.trim() || null,
            headline: headline?.trim() || null,
            brand: brand?.trim() || null,
            brand_logo_url: brand_logo_url?.trim() || null,
            asset_class: asset_class || null,
            sq_ft: sq_ft ? parseInt(String(sq_ft), 10) : null,
            lat: lat ?? null,
            lng: lng ?? null,
            notes: notes?.trim() || null,
            user_id: user.id,
            status: "active",
          })
          .select()
          .single()

        if (retryError) {
          console.error("Failed to create site (retry):", retryError)
          return NextResponse.json({ error: retryError.message }, { status: 500 })
        }

        return NextResponse.json({ site: retryData }, { status: 201 })
      }

      console.error("Failed to create site:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ site }, { status: 201 })
  } catch (err) {
    console.error("Invalid request body:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

// =============================================================================
// DELETE — Soft-delete (archive) a site from user's portfolio
// =============================================================================

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("id")

    if (!siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("site_evaluations")
      .update({ status: "archived" })
      .eq("id", siteId)
      .eq("user_id", user.id)

    if (error) {
      console.error("Failed to archive site:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete failed:", err)
    return NextResponse.json({ error: "Failed to archive site" }, { status: 500 })
  }
}
