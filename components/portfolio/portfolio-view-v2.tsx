"use client"

/**
 * Portfolio View v2 — Orchestrator
 *
 * Layout: Header → Cards + Map → Charts → Signals
 * Uses stagger-children CSS for entrance animations.
 * All data flows from a single shared hook.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CompanyLogo } from "@/components/company-logo"
import type { PortfolioAssetItem } from "./portfolio-types"
import { usePortfolioData } from "./use-portfolio-data"
import { PortfolioMap } from "./portfolio-map"
import { PortfolioCards } from "./portfolio-cards"
import { PortfolioCharts } from "./portfolio-charts"
import { PortfolioSignals } from "./portfolio-signals"

// =============================================================================
// Props
// =============================================================================

interface PortfolioViewV2Props {
  assets: PortfolioAssetItem[]
  ownerFilter?: string | null
  allOwners?: string[]
  /** "user" = user-facing portfolio, "admin" = admin view (default) */
  mode?: "user" | "admin"
  /** User email — used for company logo in user mode */
  userEmail?: string | null
  /** Callback to open the Add Site sheet (user mode) */
  onAddSite?: () => void
}

export function PortfolioViewV2({
  assets,
  ownerFilter,
  allOwners = [],
  mode = "admin",
  userEmail,
  onAddSite,
}: PortfolioViewV2Props) {
  const data = usePortfolioData(assets)
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)

  // Derived metadata for subtitle — purely factual
  const uniqueRegionNames = useMemo(
    () => [...new Set(assets.map((a) => a.region_name))],
    [assets]
  )
  const uniqueRegionCount = uniqueRegionNames.length
  const uniqueClasses = useMemo(() => {
    const counts = new Map<string, number>()
    assets.forEach((a) => {
      const cls = a.asset_class || "Other"
      counts.set(cls, (counts.get(cls) ?? 0) + 1)
    })
    return [...counts.entries()].map(([cls, n]) => (n > 1 ? `${cls} (${n})` : cls))
  }, [assets])

  // Editorial line — geography-based, factual, not metric-based
  const editorialLine = useMemo(() => {
    if (uniqueClasses.length === 0 || uniqueRegionNames.length === 0) return null
    const classLabel = uniqueClasses.length === 1
      ? uniqueClasses[0].replace(/\s*\(\d+\)/, "").toLowerCase()
      : "mixed-use"
    if (uniqueRegionNames.length <= 3) {
      return `${classLabel.charAt(0).toUpperCase() + classLabel.slice(1)} portfolio across ${uniqueRegionNames.join(", ")}`
    }
    return `${classLabel.charAt(0).toUpperCase() + classLabel.slice(1)} portfolio across ${uniqueRegionNames.length} regions`
  }, [uniqueClasses, uniqueRegionNames])

  return (
    <div className="min-h-screen bg-background page-enter">
      {/* ================================================================ */}
      {/* Sticky top nav — logo + title + back (matches GP page pattern)   */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* RegionIQ logo */}
            <Link href="https://regioniq.io" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">RegionIQ</span>
            </Link>

            <div className="h-6 w-px bg-border/60" />

            {/* Page title */}
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-purple-400" />
              <span className="text-lg font-semibold text-foreground">Portfolio</span>
            </div>
          </div>

          {/* Back link — context-dependent */}
          <Link
            href={mode === "user" ? "/dashboard" : "/admin/assets"}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {mode === "user" ? "Back to Dashboard" : "Back to Assets"}
          </Link>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Content                                                          */}
      {/* ================================================================ */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Brand card */}
        <div className="mb-10 animate-fade-up rounded-2xl bg-muted/15 border border-border/30 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">

            {/* User mode — show company logo from email */}
            {mode === "user" && (
              <div className="flex items-center gap-4">
                {userEmail && (() => {
                  // Demo overrides — map specific emails to a brand domain
                  const EMAIL_DOMAIN_OVERRIDES: Record<string, string> = {
                    "slrgrech@hotmail.com": "kinrise.com",
                  }
                  const override = EMAIL_DOMAIN_OVERRIDES[userEmail.toLowerCase()]
                  const domain = override || userEmail.split("@")[1]
                  const consumerDomains = new Set(["gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","outlook.com","hotmail.com","hotmail.co.uk","live.com","icloud.com","me.com","aol.com","protonmail.com","proton.me"])
                  const isConsumer = !override && (!domain || consumerDomains.has(domain.toLowerCase()))
                  return !isConsumer ? (
                    <CompanyLogo
                      domain={domain}
                      size={52}
                      showFallback={true}
                      className="rounded-xl ring-1 ring-border/30 shadow-sm"
                    />
                  ) : null
                })()}
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    My Portfolio
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {assets.length} location{assets.length !== 1 ? "s" : ""}
                    {" · "}
                    {uniqueRegionCount} region{uniqueRegionCount !== 1 ? "s" : ""}
                    {uniqueClasses.length > 0 && ` · ${uniqueClasses.join(", ")}`}
                  </p>
                  {editorialLine && (
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {editorialLine}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Admin mode — owner filter view */}
            {mode === "admin" && ownerFilter && (
              <div className="flex items-center gap-4">
                <CompanyLogo
                  name={ownerFilter}
                  size={52}
                  showFallback={true}
                  className="rounded-xl ring-1 ring-border/30 shadow-sm"
                />
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {ownerFilter}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {assets.length} location{assets.length !== 1 ? "s" : ""}
                    {" · "}
                    {uniqueRegionCount} region{uniqueRegionCount !== 1 ? "s" : ""}
                    {uniqueClasses.length > 0 && ` · ${uniqueClasses.join(", ")}`}
                  </p>
                  {editorialLine && (
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      {editorialLine}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Admin mode — generic heading */}
            {mode === "admin" && !ownerFilter && (
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Portfolio Overview
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {assets.length} location{assets.length !== 1 ? "s" : ""}
                  {" · "}
                  {uniqueRegionCount} region{uniqueRegionCount !== 1 ? "s" : ""}
                  {uniqueClasses.length > 0 && ` · ${uniqueClasses.join(", ")}`}
                </p>
                {editorialLine && (
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {editorialLine}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* User mode — Add Site button */}
            {mode === "user" && onAddSite && (
              <button
                onClick={onAddSite}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Site
              </button>
            )}

            {/* Admin mode — Owner dropdown */}
            {mode === "admin" && !ownerFilter && allOwners.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOwnerDropdownOpen((p) => !p)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground"
                >
                  <span>All Owners</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {ownerDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setOwnerDropdownOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] animate-in fade-in-0 zoom-in-95 duration-150">
                      <Link
                        href="/admin/portfolio"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-primary font-medium hover:bg-muted/50 transition-colors"
                        onClick={() => setOwnerDropdownOpen(false)}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        All Owners
                      </Link>
                      <div className="h-px bg-border my-1" />
                      {allOwners.map((o) => (
                        <Link
                          key={o}
                          href={`/admin/portfolio?owner=${encodeURIComponent(o)}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => setOwnerDropdownOpen(false)}
                        >
                          <CompanyLogo
                            name={o}
                            size={20}
                            showFallback={true}
                            className="rounded"
                          />
                          {o}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Admin mode — Clear filter */}
            {mode === "admin" && ownerFilter && (
              <Link
                href="/admin/portfolio"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Clear filter"
              >
                <X className="h-3 w-3" />
                Clear
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Sections — staggered entrance, dramatic spacing                  */}
      {/* ================================================================ */}
      <div className="stagger-children space-y-10">
        {/* Section 1: Cards + Map */}
        {mode === "user" && assets.length >= 2 ? (
          /* ── User mode, 2+ sites: side-by-side — cards left, map right (height matches cards) ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-stretch">
            <div>
              <PortfolioCards
                assets={assets}
                visible={data.visible}
                signalsMap={data.signalsMap}
                selectedMetricLabel={data.selectedMetricConfig.label}
                selectedMetricUnit={data.selectedMetricConfig.unit}
                metricValueForAsset={data.metricValueForAsset}
                isLoading={data.isLoading}
                toggleAsset={data.toggleAsset}
                hoveredAssetIndex={data.hoveredAssetIndex}
                onAssetHover={data.setHoveredAssetIndex}
                mode={mode}
              />
            </div>
            <div className="rounded-2xl overflow-hidden border border-border/40 min-h-[280px]">
              <PortfolioMap
                assets={assets}
                geocodedAssets={data.geocodedAssets}
                visible={data.visible}
                mapLoading={data.mapLoading}
                mapRef={data.mapRef}
                fitMapBounds={data.fitMapBounds}
                toggleAsset={data.toggleAsset}
                hoveredAssetIndex={data.hoveredAssetIndex}
                onAssetHover={data.setHoveredAssetIndex}
                signalsMap={data.signalsMap}
                selectedMetric={data.selectedMetric}
                setSelectedMetric={data.setSelectedMetric}
                baseYear={data.baseYear}
                ownerFilter={ownerFilter}
                mode={mode}
              />
            </div>
          </div>
        ) : mode === "user" ? (
          /* ── User mode, 1 site: cards full-width, map below as complementary preview ── */
          <div className="space-y-5">
            <PortfolioCards
              assets={assets}
              visible={data.visible}
              signalsMap={data.signalsMap}
              selectedMetricLabel={data.selectedMetricConfig.label}
              selectedMetricUnit={data.selectedMetricConfig.unit}
              metricValueForAsset={data.metricValueForAsset}
              isLoading={data.isLoading}
              toggleAsset={data.toggleAsset}
              hoveredAssetIndex={data.hoveredAssetIndex}
              onAssetHover={data.setHoveredAssetIndex}
              mode={mode}
            />
            <div className="h-[280px] rounded-2xl overflow-hidden border border-border/40">
              <PortfolioMap
                assets={assets}
                geocodedAssets={data.geocodedAssets}
                visible={data.visible}
                mapLoading={data.mapLoading}
                mapRef={data.mapRef}
                fitMapBounds={data.fitMapBounds}
                toggleAsset={data.toggleAsset}
                hoveredAssetIndex={data.hoveredAssetIndex}
                onAssetHover={data.setHoveredAssetIndex}
                signalsMap={data.signalsMap}
                selectedMetric={data.selectedMetric}
                setSelectedMetric={data.setSelectedMetric}
                baseYear={data.baseYear}
                ownerFilter={ownerFilter}
                mode={mode}
              />
            </div>
          </div>
        ) : (
          /* ── Admin mode: side-by-side — wide cards left, sidebar map right ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            <div>
              <PortfolioCards
                assets={assets}
                visible={data.visible}
                signalsMap={data.signalsMap}
                selectedMetricLabel={data.selectedMetricConfig.label}
                selectedMetricUnit={data.selectedMetricConfig.unit}
                metricValueForAsset={data.metricValueForAsset}
                isLoading={data.isLoading}
                toggleAsset={data.toggleAsset}
                hoveredAssetIndex={data.hoveredAssetIndex}
                onAssetHover={data.setHoveredAssetIndex}
                mode={mode}
              />
            </div>
            <div className="h-[280px] lg:h-auto rounded-2xl overflow-hidden">
              <PortfolioMap
                assets={assets}
                geocodedAssets={data.geocodedAssets}
                visible={data.visible}
                mapLoading={data.mapLoading}
                mapRef={data.mapRef}
                fitMapBounds={data.fitMapBounds}
                toggleAsset={data.toggleAsset}
                hoveredAssetIndex={data.hoveredAssetIndex}
                onAssetHover={data.setHoveredAssetIndex}
                signalsMap={data.signalsMap}
                selectedMetric={data.selectedMetric}
                setSelectedMetric={data.setSelectedMetric}
                baseYear={data.baseYear}
                ownerFilter={ownerFilter}
                mode={mode}
              />
            </div>
          </div>
        )}

        {/* Section 3: Charts */}
        <div>
          <PortfolioCharts
            assets={assets}
            visibleAssets={data.visibleAssets}
            visible={data.visible}
            selectedMetric={data.selectedMetric}
            setSelectedMetric={data.setSelectedMetric}
            selectedMetricConfig={data.selectedMetricConfig}
            chartData={data.chartData}
            yDomain={data.yDomain}
            barData={data.barData}
            baseYear={data.baseYear}
            forecastStartYear={data.forecastStartYear}
            isLoading={data.isLoading}
          />
        </div>

        {/* Section 4: Signals */}
        <div>
          <PortfolioSignals
            assets={assets}
            visible={data.visible}
            signalsMap={data.signalsMap}
            signalsLoading={data.signalsLoading}
          />
        </div>
      </div>
      </div>
    </div>
  )
}
