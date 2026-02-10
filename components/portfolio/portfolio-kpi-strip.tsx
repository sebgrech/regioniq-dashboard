"use client"

import { useMemo } from "react"
import type {
  PortfolioAssetItem,
  RegionSignals,
} from "./portfolio-types"
import { SIGNAL_IDS } from "./portfolio-types"

interface PortfolioKpiStripProps {
  assets: PortfolioAssetItem[]
  signalsMap: Record<string, RegionSignals>
  signalsLoading: boolean
}

export function PortfolioKpiStrip({
  assets,
  signalsMap,
  signalsLoading,
}: PortfolioKpiStripProps) {
  const kpis = useMemo(() => {
    // Distinct regions
    const regionNames = [...new Set(assets.map((a) => a.region_name))]

    // Asset classes
    const classCounts = new Map<string, number>()
    assets.forEach((a) => {
      const cls = a.asset_class || "Other"
      classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1)
    })
    const assetClasses = [...classCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cls, count]) => `${cls} (${count})`)

    // Data coverage — how many signals are loaded
    const signalCount = SIGNAL_IDS.length
    const regionsWithSignals = assets.filter(
      (a) => signalsMap[a.region_code]?.signals
    ).length

    return { regionNames, assetClasses, signalCount, regionsWithSignals }
  }, [assets, signalsMap])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl border border-border/40 bg-border/40 overflow-hidden">
      {/* Locations */}
      <div className="p-4 bg-card/80">
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          Locations
        </span>
        <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
          {assets.length}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {kpis.regionNames.length} region{kpis.regionNames.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Regions covered */}
      <div className="p-4 bg-card/80">
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          Regions
        </span>
        <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">
          {kpis.regionNames.length <= 4
            ? kpis.regionNames.join(", ")
            : `${kpis.regionNames.slice(0, 3).join(", ")} +${kpis.regionNames.length - 3}`}
        </p>
      </div>

      {/* Asset classes */}
      <div className="p-4 bg-card/80">
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          Asset Classes
        </span>
        <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">
          {kpis.assetClasses.length <= 3
            ? kpis.assetClasses.join(", ")
            : `${kpis.assetClasses.slice(0, 2).join(", ")} +${kpis.assetClasses.length - 2}`}
        </p>
      </div>

      {/* Data coverage */}
      <div className="p-4 bg-card/80">
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          Data Coverage
        </span>
        {signalsLoading ? (
          <div className="h-5 w-20 skeleton-shimmer rounded mt-1.5" />
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mt-1.5">
              {kpis.signalCount} signals · 4 metrics
            </p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              {kpis.regionsWithSignals}/{assets.length} locations profiled
            </p>
          </>
        )}
      </div>
    </div>
  )
}
