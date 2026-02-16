import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { PortfolioViewV2 } from "@/components/portfolio/portfolio-view-v2"
import type { PortfolioAssetItem } from "@/components/portfolio/portfolio-types"

export const dynamic = "force-dynamic"

// Public shared portfolio page — no auth required
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function SharedPortfolioPage({ params }: PageProps) {
  const { slug } = await params

  const { data: portfolio, error: portfolioError } = await supabase
    .from("shared_portfolios")
    .select("id, slug, name, asset_slugs, created_at")
    .eq("slug", slug)
    .single()

  if (portfolioError || !portfolio) {
    notFound()
  }

  const assetSlugs: string[] = portfolio.asset_slugs ?? []
  if (assetSlugs.length === 0) {
    notFound()
  }

  const { data: dealAssets } = await supabase
    .from("asset_pages")
    .select("id, slug, address, postcode, region_code, region_name, asset_type, asset_class, sq_ft, broker")
    .in("slug", assetSlugs)

  const { data: portfolioAssets } = await supabase
    .from("portfolio_assets")
    .select("id, slug, address, postcode, region_code, region_name, asset_type, asset_class, sq_ft, portfolio_owner")
    .in("slug", assetSlugs)

  const assets: PortfolioAssetItem[] = [
    ...(dealAssets ?? []).map((a: any) => ({
      id: a.id, slug: a.slug, address: a.address, postcode: a.postcode,
      region_code: a.region_code, region_name: a.region_name,
      asset_type: a.asset_type, asset_class: a.asset_class,
      sq_ft: a.sq_ft, portfolio_owner: a.broker ?? null, source: "deal" as const,
    })),
    ...(portfolioAssets ?? []).map((a: any) => ({
      id: a.id, slug: a.slug, address: a.address, postcode: a.postcode,
      region_code: a.region_code, region_name: a.region_name,
      asset_type: a.asset_type, asset_class: a.asset_class,
      sq_ft: a.sq_ft, portfolio_owner: a.portfolio_owner, source: "portfolio" as const,
    })),
  ]

  const seen = new Set<string>()
  const deduped = assets.filter((a) => {
    if (seen.has(a.slug)) return false
    seen.add(a.slug)
    return true
  })

  const orderMap = new Map(assetSlugs.map((s, i) => [s, i]))
  deduped.sort((a, b) => (orderMap.get(a.slug) ?? 99) - (orderMap.get(b.slug) ?? 99))

  return (
    <PortfolioViewV2
      assets={deduped}
      ownerFilter={portfolio.name}
      mode="shared"
    />
  )
}
