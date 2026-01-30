import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ExternalLink, Plus, Building2, MapPin, TrendingUp, Briefcase } from "lucide-react"

export const dynamic = "force-dynamic"

interface AssetPage {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  asset_type: string | null
  asset_class: string | null
  broker: string | null
  tenant: string | null
  created_at: string
  page_type: 'sell_side' | 'buy_side' | null
}

interface PortfolioAsset {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  asset_type: string | null
  asset_class: string | null
  sq_ft: number | null
  headline: string | null
  portfolio_owner: string | null
  created_at: string
}

export default async function AssetsPage() {
  const { user, response } = await requireAdmin()
  if (!user) redirect("/login")

  const supabase = createSupabaseAdminClient()

  // Fetch deal assets (OM-based) from asset_pages table
  const { data: dealAssets, error: dealError } = await supabase
    .from("asset_pages")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, broker, tenant, created_at, page_type"
    )
    .order("created_at", { ascending: false })
    .limit(100)

  // Fetch portfolio assets from separate portfolio_assets table
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Asset Pages</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage and preview all asset analysis pages
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {(dealAssets?.length ?? 0) + (portfolioAssets?.length ?? 0)} assets
              </span>
              <Link
                href="/admin/site/new"
                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Site Evaluation
              </Link>
            </div>
          </div>
        </div>

        {/* Deal Assets Section */}
        {dealAssets.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-foreground">Deal Assets</h2>
              <span className="text-sm text-muted-foreground">({dealAssets.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dealAssets.slice(0, 6).map((asset) => (
                <div
                  key={asset.id}
                  className="p-4 bg-card border border-border rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {asset.asset_class || asset.asset_type || "Asset"}
                      </span>
                    </div>
                    {asset.broker && (
                      <span className="text-[10px] text-muted-foreground">
                        via {asset.broker}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                    {asset.address}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{asset.region_name}</span>
                  </div>
                  {/* View links */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <Link
                      href={`/a/${asset.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Briefcase className="h-3 w-3" />
                      Sell-side
                    </Link>
                    <Link
                      href={`/gp/${asset.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Buy-side
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Assets Section */}
        {portfolioAssets.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-foreground">Portfolio Assets</h2>
              <span className="text-sm text-muted-foreground">({portfolioAssets.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolioAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-4 bg-card border border-emerald-500/20 rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Building2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {asset.asset_class || asset.asset_type || "Asset"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Portfolio
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                    {asset.address}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{asset.region_name}</span>
                  </div>
                  {/* View link - portfolio assets go to GP view */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <Link
                      href={`/gp/${asset.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <TrendingUp className="h-3 w-3" />
                      View Economic Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deal Assets Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-8">
          <div className="px-4 py-3 bg-blue-500/5 border-b border-border">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400">Deal Assets (from OMs)</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Slug</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Address</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Region</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Broker</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Created</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dealAssets?.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <code className="text-sm font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                      {asset.slug}
                    </code>
                  </td>
                  <td className="p-3 text-sm text-foreground max-w-[200px] truncate">{asset.address}</td>
                  <td className="p-3 text-sm text-muted-foreground">{asset.region_name}</td>
                  <td className="p-3">
                    {asset.asset_class ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded">
                        {asset.asset_class}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{asset.broker || '—'}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(asset.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/a/${asset.slug}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        title="Sell-side view"
                      >
                        <Briefcase className="h-3 w-3" />
                        Sell
                      </Link>
                      <Link
                        href={`/gp/${asset.slug}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        title="Buy-side view"
                      >
                        <TrendingUp className="h-3 w-3" />
                        Buy
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!dealAssets || dealAssets.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No deal assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Portfolio Assets Table */}
        <div className="bg-card border border-emerald-500/20 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/20">
            <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Portfolio Assets</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Slug</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Address</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Region</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Owner</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Created</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {portfolioAssets?.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded">
                      {asset.slug}
                    </code>
                  </td>
                  <td className="p-3 text-sm text-foreground max-w-[200px] truncate">{asset.address}</td>
                  <td className="p-3 text-sm text-muted-foreground">{asset.region_name}</td>
                  <td className="p-3">
                    {asset.asset_class ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded">
                        {asset.asset_class}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{asset.portfolio_owner || '—'}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(asset.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/gp/${asset.slug}`}
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      title="Economic profile view"
                    >
                      <TrendingUp className="h-3 w-3" />
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
              {(!portfolioAssets || portfolioAssets.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No portfolio assets found. Add one to the <code className="px-1 py-0.5 bg-muted rounded text-xs">portfolio_assets</code> table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Info footer */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
          <h3 className="text-sm font-medium text-foreground mb-2">Creating Assets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Deal Assets (from OMs)</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Insert into <code className="px-1 py-0.5 bg-muted rounded text-[10px]">asset_pages</code> table
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• <code className="px-0.5 bg-muted rounded">/a/[slug]</code> — Sell-side view</li>
                <li>• <code className="px-0.5 bg-muted rounded">/gp/[slug]</code> — Buy-side view</li>
                <li>• Includes broker, yield, tenant, lease expiry</li>
              </ul>
            </div>
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Portfolio Assets</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Insert into <code className="px-1 py-0.5 bg-muted rounded text-[10px]">portfolio_assets</code> table
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• <code className="px-0.5 bg-muted rounded">/gp/[slug]</code> — Economic profile view</li>
                <li>• No broker/yield/lease fields needed</li>
                <li>• Optional: portfolio_owner field</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
