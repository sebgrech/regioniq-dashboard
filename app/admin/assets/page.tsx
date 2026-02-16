import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import { AssetsClient } from "./assets-client"

export const dynamic = "force-dynamic"

export default async function AssetsPage() {
  const { user, response } = await requireAdmin()
  if (!user) redirect("/login")

  const supabase = createSupabaseAdminClient()

  const { data: dealAssets, error: dealError } = await supabase
    .from("asset_pages")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, broker, tenant, created_at, page_type"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  const { data: portfolioAssets, error: portfolioError } = await supabase
    .from("portfolio_assets")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, sq_ft, headline, portfolio_owner, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  const error = dealError || portfolioError

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-4">Asset Pages</h1>
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            Error loading assets: {error.message}
          </div>
        </div>
      </div>
    )
  }

  return (
    <AssetsClient
      dealAssets={dealAssets ?? []}
      portfolioAssets={portfolioAssets ?? []}
    />
  )
}
