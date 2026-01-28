import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api/require-admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ExternalLink, Plus, Building2, MapPin } from "lucide-react"

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
}

export default async function AssetsPage() {
  const { user, response } = await requireAdmin()
  if (!user) redirect("/login")

  const supabase = createSupabaseAdminClient()

  const { data: assets, error } = await supabase
    .from("asset_pages")
    .select(
      "id, slug, address, postcode, region_code, region_name, asset_type, asset_class, broker, tenant, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100)

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
                {assets?.length ?? 0} assets
              </span>
              {/* Future: Add new asset button */}
              {/* <Link
                href="/admin/assets/new"
                className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Asset
              </Link> */}
            </div>
          </div>
        </div>

        {/* Quick links grid */}
        {assets && assets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {assets.slice(0, 6).map((asset) => (
              <Link
                key={asset.id}
                href={`/a/${asset.slug}`}
                className="group p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-card/80 transition-all"
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
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                  {asset.address}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{asset.region_name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Full table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Address
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Region
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Broker
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Created
                </th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {assets?.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <code className="text-sm font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                      {asset.slug}
                    </code>
                  </td>
                  <td className="p-3 text-sm text-foreground max-w-[200px] truncate">
                    {asset.address}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {asset.region_name}
                  </td>
                  <td className="p-3">
                    {asset.asset_class ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded">
                        {asset.asset_class}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {asset.broker || "—"}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(asset.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/a/${asset.slug}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {(!assets || assets.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No asset pages found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Info footer */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border/50">
          <h3 className="text-sm font-medium text-foreground mb-2">Creating Asset Pages</h3>
          <p className="text-sm text-muted-foreground">
            Asset pages are created by inserting records into the <code className="px-1 py-0.5 bg-muted rounded text-xs">asset_pages</code> table in Supabase.
            Each record generates a unique URL at <code className="px-1 py-0.5 bg-muted rounded text-xs">/a/[slug]</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
