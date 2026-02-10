import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import { PortfolioViewV2 } from "@/components/portfolio/portfolio-view-v2"

export const dynamic = "force-dynamic"

// =============================================================================
// Types - shared with PortfolioView
// =============================================================================

export interface PortfolioAssetItem {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  asset_type: string | null
  asset_class: string | null
  sq_ft: number | null
  portfolio_owner: string | null
  source: "deal" | "portfolio"
}

// =============================================================================
// Server Component
// =============================================================================

interface PageProps {
  searchParams: Promise<{ owner?: string }>
}

export default async function PortfolioPage({ searchParams }: PageProps) {
  const { user } = await requireAdmin()
  if (!user) redirect("/login")

  const { owner } = await searchParams
  const ownerFilter = owner ?? null

  const supabase = createSupabaseAdminClient()

  // Fetch deal assets (OM-based) from asset_pages table
  // Include broker field so we can filter deal assets by broker when ?owner= is set
  let dealQuery = supabase
    .from("asset_pages")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, sq_ft, broker"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  // If filtering by owner, only include deal assets where broker matches
  if (ownerFilter) {
    dealQuery = dealQuery.ilike("broker", `%${ownerFilter}%`)
  }

  const { data: dealAssets, error: dealError } = await dealQuery

  // Fetch portfolio assets from portfolio_assets table
  let portfolioQuery = supabase
    .from("portfolio_assets")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, sq_ft, portfolio_owner"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  // If filtering by owner, match portfolio_owner
  if (ownerFilter) {
    portfolioQuery = portfolioQuery.ilike("portfolio_owner", `%${ownerFilter}%`)
  }

  const { data: portfolioAssets, error: portfolioError } = await portfolioQuery

  const error = dealError || portfolioError

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-4">Portfolio</h1>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            Error loading assets: {error.message}
          </div>
        </div>
      </div>
    )
  }

  // Normalize both sources into a unified shape
  const assets: PortfolioAssetItem[] = [
    ...(dealAssets ?? []).map((a: any) => ({
      id: a.id,
      slug: a.slug,
      address: a.address,
      postcode: a.postcode,
      region_code: a.region_code,
      region_name: a.region_name,
      asset_type: a.asset_type,
      asset_class: a.asset_class,
      sq_ft: a.sq_ft,
      portfolio_owner: a.broker ?? null,
      source: "deal" as const,
    })),
    ...(portfolioAssets ?? []).map((a: any) => ({
      id: a.id,
      slug: a.slug,
      address: a.address,
      postcode: a.postcode,
      region_code: a.region_code,
      region_name: a.region_name,
      asset_type: a.asset_type,
      asset_class: a.asset_class,
      sq_ft: a.sq_ft,
      portfolio_owner: a.portfolio_owner,
      source: "portfolio" as const,
    })),
  ]

  // Deduplicate by slug (in case same asset is in both tables)
  const seen = new Set<string>()
  const deduped = assets.filter((a) => {
    if (seen.has(a.slug)) return false
    seen.add(a.slug)
    return true
  })

  // Collect all unique owners for the dropdown picker.
  // When filtered by ?owner=, the filtered results won't contain other owners,
  // so we fetch owners separately from the full dataset.
  let allOwners: string[] = []
  try {
    const { data: ownerRows } = await supabase
      .from("portfolio_assets")
      .select("portfolio_owner")
      .not("portfolio_owner", "is", null)
      .order("portfolio_owner")

    const { data: brokerRows } = await supabase
      .from("asset_pages")
      .select("broker")
      .not("broker", "is", null)
      .order("broker")

    const ownerSet = new Set<string>()
    ownerRows?.forEach((r: any) => { if (r.portfolio_owner) ownerSet.add(r.portfolio_owner) })
    brokerRows?.forEach((r: any) => { if (r.broker) ownerSet.add(r.broker) })
    allOwners = Array.from(ownerSet).sort()
  } catch {
    // Fallback: extract from filtered results
    allOwners = Array.from(
      new Set(
        deduped
          .map((a) => a.portfolio_owner)
          .filter((o): o is string => !!o)
      )
    ).sort()
  }

  return (
    <PortfolioViewV2
      assets={deduped}
      ownerFilter={ownerFilter}
      allOwners={allOwners}
    />
  )
}
