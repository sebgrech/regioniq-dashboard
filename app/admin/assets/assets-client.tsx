"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  ExternalLink,
  Plus,
  Building2,
  MapPin,
  TrendingUp,
  Briefcase,
  ShoppingBag,
  Home,
  Dumbbell,
  Warehouse,
  UtensilsCrossed,
  Check,
  X,
  Copy,
  Loader2,
  type LucideIcon,
} from "lucide-react"

function getAssetClassIcon(assetClass: string | null): LucideIcon {
  if (!assetClass) return Building2
  const normalized = assetClass.toLowerCase().trim()
  switch (normalized) {
    case "retail":
      return ShoppingBag
    case "office":
      return Briefcase
    case "residential":
      return Home
    case "leisure":
      return Dumbbell
    case "industrial":
      return Warehouse
    case "f&b":
    case "food & beverage":
    case "restaurant":
      return UtensilsCrossed
    default:
      return Building2
  }
}

export interface AssetPageData {
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
  page_type: "sell_side" | "buy_side" | null
}

export interface PortfolioAssetData {
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

interface AssetsClientProps {
  dealAssets: AssetPageData[]
  portfolioAssets: PortfolioAssetData[]
}

export function AssetsClient({ dealAssets, portfolioAssets }: AssetsClientProps) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [portfolioName, setPortfolioName] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAssetSlugs = [
    ...dealAssets.map((a) => a.slug),
    ...portfolioAssets.map((a) => a.slug),
  ]

  const toggleSelect = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(allAssetSlugs))
  }, [allAssetSlugs])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelected(new Set())
    setCreatedUrl(null)
    setError(null)
  }, [])

  const createPortfolio = async () => {
    if (selected.size === 0) return
    setCreating(true)
    setError(null)
    setCreatedUrl(null)

    try {
      const res = await fetch("/api/admin/shared-portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: portfolioName.trim() || undefined,
          assetSlugs: [...selected],
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }

      const data = await res.json()
      setCreatedUrl(data.url || `/p/${data.slug}`)
      setPortfolioName("")
    } catch (err: any) {
      setError(err.message || "Failed to create portfolio")
    } finally {
      setCreating(false)
    }
  }

  const copyUrl = async () => {
    if (!createdUrl) return
    try {
      await navigator.clipboard.writeText(createdUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            &larr; Back to Dashboard
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
                {dealAssets.length + portfolioAssets.length} assets
              </span>
              {!selectMode ? (
                <button
                  onClick={() => setSelectMode(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  Create Portfolio
                </button>
              ) : (
                <button
                  onClick={exitSelectMode}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              )}
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

        {/* Select-mode banner */}
        {selectMode && (
          <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {selected.size === 0
                ? "Select assets below to include in the portfolio"
                : `${selected.size} asset${selected.size !== 1 ? "s" : ""} selected`}
            </span>
            <button
              onClick={selectAll}
              className="text-primary hover:text-primary/80 text-xs font-medium"
            >
              Select all
            </button>
            {selected.size > 0 && (
              <button
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Deal Assets Section */}
        {dealAssets.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-foreground">Deal Assets</h2>
              <span className="text-sm text-muted-foreground">({dealAssets.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dealAssets.slice(0, 6).map((asset) => {
                const isSelected = selected.has(asset.slug)
                return (
                  <div
                    key={asset.id}
                    className={`p-4 bg-card border rounded-xl transition-all ${
                      selectMode
                        ? isSelected
                          ? "border-primary ring-2 ring-primary/20 cursor-pointer"
                          : "border-border cursor-pointer hover:border-muted-foreground/30"
                        : "border-border"
                    }`}
                    onClick={selectMode ? () => toggleSelect(asset.slug) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {selectMode && (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        )}
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          {(() => {
                            const Icon = getAssetClassIcon(asset.asset_class)
                            return <Icon className="h-4 w-4 text-primary" />
                          })()}
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
                    {!selectMode && (
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
                    )}
                  </div>
                )
              })}
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
              {portfolioAssets.map((asset) => {
                const isSelected = selected.has(asset.slug)
                return (
                  <div
                    key={asset.id}
                    className={`p-4 bg-card border rounded-xl transition-all ${
                      selectMode
                        ? isSelected
                          ? "border-primary ring-2 ring-primary/20 cursor-pointer"
                          : "border-emerald-500/20 cursor-pointer hover:border-muted-foreground/30"
                        : "border-emerald-500/20"
                    }`}
                    onClick={selectMode ? () => toggleSelect(asset.slug) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {selectMode && (
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        )}
                        <div className="p-1.5 rounded-lg bg-emerald-500/10">
                          {(() => {
                            const Icon = getAssetClassIcon(asset.asset_class)
                            return <Icon className="h-4 w-4 text-emerald-500" />
                          })()}
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
                    {!selectMode && (
                      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                        <Link
                          href={`/gp/${asset.slug}`}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <TrendingUp className="h-3 w-3" />
                          View Economic Profile
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
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
                {selectMode && (
                  <th className="w-10 p-3" />
                )}
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
              {dealAssets?.map((asset) => {
                const isSelected = selected.has(asset.slug)
                return (
                  <tr
                    key={asset.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                      selectMode ? "cursor-pointer" : ""
                    } ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={selectMode ? () => toggleSelect(asset.slug) : undefined}
                  >
                    {selectMode && (
                      <td className="p-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </td>
                    )}
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
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{asset.broker || "\u2014"}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(asset.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/a/${asset.slug}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          title="Sell-side view"
                          onClick={(e) => selectMode && e.preventDefault()}
                        >
                          <Briefcase className="h-3 w-3" />
                          Sell
                        </Link>
                        <Link
                          href={`/gp/${asset.slug}`}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                          title="Buy-side view"
                          onClick={(e) => selectMode && e.preventDefault()}
                        >
                          <TrendingUp className="h-3 w-3" />
                          Buy
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(!dealAssets || dealAssets.length === 0) && (
                <tr>
                  <td colSpan={selectMode ? 8 : 7} className="p-8 text-center text-muted-foreground">
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
            <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Portfolio Assets
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {selectMode && (
                  <th className="w-10 p-3" />
                )}
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
              {portfolioAssets?.map((asset) => {
                const isSelected = selected.has(asset.slug)
                return (
                  <tr
                    key={asset.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                      selectMode ? "cursor-pointer" : ""
                    } ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={selectMode ? () => toggleSelect(asset.slug) : undefined}
                  >
                    {selectMode && (
                      <td className="p-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </td>
                    )}
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
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{asset.portfolio_owner || "\u2014"}</td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(asset.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/gp/${asset.slug}`}
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        title="Economic profile view"
                        onClick={(e) => selectMode && e.preventDefault()}
                      >
                        <TrendingUp className="h-3 w-3" />
                        View Profile
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {(!portfolioAssets || portfolioAssets.length === 0) && (
                <tr>
                  <td colSpan={selectMode ? 8 : 7} className="p-8 text-center text-muted-foreground">
                    No portfolio assets found.
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
              <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                Deal Assets (from OMs)
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Insert into <code className="px-1 py-0.5 bg-muted rounded text-[10px]">asset_pages</code>{" "}
                table
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>
                  &bull; <code className="px-0.5 bg-muted rounded">/a/[slug]</code> &mdash; Sell-side view
                </li>
                <li>
                  &bull; <code className="px-0.5 bg-muted rounded">/gp/[slug]</code> &mdash; Buy-side view
                </li>
                <li>&bull; Includes broker, yield, tenant, lease expiry</li>
              </ul>
            </div>
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                Portfolio Assets
              </h4>
              <p className="text-xs text-muted-foreground mb-2">
                Insert into{" "}
                <code className="px-1 py-0.5 bg-muted rounded text-[10px]">portfolio_assets</code> table
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>
                  &bull; <code className="px-0.5 bg-muted rounded">/gp/[slug]</code> &mdash; Economic
                  profile view
                </li>
                <li>&bull; No broker/yield/lease fields needed</li>
                <li>&bull; Optional: portfolio_owner field</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Sticky bottom bar — visible when in select mode with selections  */}
      {/* ================================================================ */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-lg">
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                {selected.size} asset{selected.size !== 1 ? "s" : ""} selected
              </span>
              <input
                type="text"
                placeholder="Portfolio name (optional)"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {createdUrl ? (
              <div className="flex items-center gap-3">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[300px] truncate">
                  {createdUrl}
                </code>
                <button
                  onClick={copyUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy URL
                    </>
                  )}
                </button>
                <Link
                  href={createdUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {error && (
                  <span className="text-xs text-destructive">{error}</span>
                )}
                <button
                  onClick={createPortfolio}
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Portfolio
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
