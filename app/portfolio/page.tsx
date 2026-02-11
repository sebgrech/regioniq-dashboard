import { createSupabaseServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { PortfolioClientShell } from "./portfolio-client-shell"
import type { PortfolioAssetItem } from "@/components/portfolio/portfolio-types"

export const dynamic = "force-dynamic"

// =============================================================================
// Server Component — user-scoped portfolio
// =============================================================================

export default async function UserPortfolioPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login?returnTo=/portfolio")
  }

  // Fetch this user's sites (RLS also enforces this, but explicit filter is cleaner)
  const { data: sites, error } = await supabase
    .from("site_evaluations")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_class, sq_ft, brand, status, created_at"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch user portfolio:", error)
  }

  // Map to PortfolioAssetItem shape
  const assets: PortfolioAssetItem[] = (sites ?? []).map((s: any) => ({
    id: s.id,
    slug: s.slug,
    address: s.address,
    postcode: s.postcode,
    region_code: s.region_code,
    region_name: s.region_name,
    asset_type: s.asset_class ?? null,
    asset_class: s.asset_class ?? null,
    sq_ft: s.sq_ft ?? null,
    portfolio_owner: null,
    source: "user" as const,
  }))

  return (
    <PortfolioClientShell
      assets={assets}
      userEmail={user.email ?? null}
    />
  )
}
