"use client"

/**
 * Portfolio View v2 — Orchestrator
 *
 * Layout: Header → KPI Strip → Cards + Map → Charts → Signals
 * Uses stagger-children CSS for entrance animations.
 * All data flows from a single shared hook.
 */

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  X,
} from "lucide-react"
import { CompanyLogo } from "@/components/company-logo"
import { cn } from "@/lib/utils"
import type { PortfolioAssetItem } from "./portfolio-types"
import { usePortfolioData } from "./use-portfolio-data"
import { PortfolioKpiStrip } from "./portfolio-kpi-strip"
import { PortfolioMap } from "./portfolio-map"
import { PortfolioCards } from "./portfolio-cards"
import { PortfolioCharts } from "./portfolio-charts"
import { PortfolioSignals } from "./portfolio-signals"

// =============================================================================
// Props (same interface as v1 for drop-in swap)
// =============================================================================

interface PortfolioViewV2Props {
  assets: PortfolioAssetItem[]
  ownerFilter?: string | null
  allOwners?: string[]
}

export function PortfolioViewV2({
  assets,
  ownerFilter,
  allOwners = [],
}: PortfolioViewV2Props) {
  const data = usePortfolioData(assets)
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 page-enter">
      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}
      <div className="mb-6 animate-fade-up">
        <Link
          href="/admin/assets"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Assets
        </Link>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            {/* Owner logo + name (when filtered) */}
            {ownerFilter && (
              <div className="flex items-center gap-3">
                <CompanyLogo
                  name={ownerFilter}
                  size={40}
                  showFallback={true}
                  className="rounded-lg"
                />
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {ownerFilter}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Portfolio &middot; {assets.length} asset
                    {assets.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Generic heading */}
            {!ownerFilter && (
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Portfolio Overview
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Cross-location economic comparison &middot; {assets.length}{" "}
                  assets
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Owner dropdown */}
            {!ownerFilter && allOwners.length > 0 && (
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

            {/* Clear filter */}
            {ownerFilter && (
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
      {/* Sections — staggered entrance                                    */}
      {/* ================================================================ */}
      <div className="stagger-children">
        {/* Section 1: KPI Strip */}
        <div className="mb-6">
          <PortfolioKpiStrip
            assets={assets}
            seriesMap={data.seriesMap}
            signalsMap={data.signalsMap}
            baseYear={data.baseYear}
            selectedMetricLabel={data.selectedMetricConfig.label}
            selectedMetricUnit={data.selectedMetricConfig.unit}
            isLoading={data.isLoading}
            signalsLoading={data.signalsLoading}
          />
        </div>

        {/* Section 2: Cards (left) + Map (right) */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: compact cards */}
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
          />

          {/* Right: map with LAD boundaries (sticky) */}
          <div className="lg:sticky lg:top-4 lg:self-start h-[280px] lg:h-[460px]">
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
            />
          </div>
        </div>

        {/* Section 3: Charts */}
        <div className="mb-10">
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
        <div className="mb-10">
          <PortfolioSignals
            assets={assets}
            visible={data.visible}
            signalsMap={data.signalsMap}
            signalsLoading={data.signalsLoading}
          />
        </div>
      </div>
    </div>
  )
}
