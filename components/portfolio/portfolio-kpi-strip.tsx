"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, MapPin, BarChart3 } from "lucide-react"
import type {
  PortfolioAssetItem,
  RegionSignals,
  AssetSeriesData,
} from "./portfolio-types"
import { ASSET_COLORS, formatAbsoluteValue } from "./portfolio-types"

interface PortfolioKpiStripProps {
  assets: PortfolioAssetItem[]
  seriesMap: Record<string, AssetSeriesData>
  signalsMap: Record<string, RegionSignals>
  baseYear: number
  selectedMetricLabel: string
  selectedMetricUnit: string
  isLoading: boolean
  signalsLoading: boolean
}

export function PortfolioKpiStrip({
  assets,
  seriesMap,
  signalsMap,
  baseYear,
  selectedMetricLabel,
  selectedMetricUnit,
  isLoading,
  signalsLoading,
}: PortfolioKpiStripProps) {
  type AssetKpi = { name: string; value: number; color: string }

  const kpis = useMemo<{
    distinctRegions: number
    bestAsset: AssetKpi | null
    worstAsset: AssetKpi | null
    dominantArchetype: string | null
  }>(() => {
    // Distinct regions
    const regionSet = new Set(assets.map((a) => a.region_code))
    const distinctRegions = regionSet.size

    // Best & worst performing on selected metric (absolute value)
    let bestAsset: AssetKpi | null = null
    let worstAsset: AssetKpi | null = null

    assets.forEach((a, i) => {
      const series = seriesMap[a.region_code]
      if (!series) return
      const pt = series.data.find((d) => d.year === baseYear)
      if (!pt) return
      const color = ASSET_COLORS[i % ASSET_COLORS.length]
      if (!bestAsset || pt.value > bestAsset.value) {
        bestAsset = { name: a.region_name, value: pt.value, color }
      }
      if (!worstAsset || pt.value < worstAsset.value) {
        worstAsset = { name: a.region_name, value: pt.value, color }
      }
    })

    // Count dominant archetype
    const archetypeCounts = new Map<string, number>()
    assets.forEach((a) => {
      const arch = signalsMap[a.region_code]?.archetype
      if (arch) archetypeCounts.set(arch, (archetypeCounts.get(arch) ?? 0) + 1)
    })
    let dominantArchetype: string | null = null
    let maxCount = 0
    for (const [arch, count] of archetypeCounts) {
      if (count > maxCount) {
        dominantArchetype = arch
        maxCount = count
      }
    }

    return { distinctRegions, bestAsset, worstAsset, dominantArchetype }
  }, [assets, seriesMap, signalsMap, baseYear])

  const shimmer = "h-5 w-20 skeleton-shimmer rounded"

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total assets / regions */}
      <div className="p-4 rounded-xl bg-card/60 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Portfolio
          </span>
        </div>
        <p className="text-xl font-bold text-foreground tabular-nums">
          {assets.length}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            asset{assets.length !== 1 ? "s" : ""}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {kpis.distinctRegions} distinct region
          {kpis.distinctRegions !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Best performer */}
      <div className="p-4 rounded-xl bg-card/60 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Leading
          </span>
        </div>
        {isLoading ? (
          <div className={shimmer} />
        ) : kpis.bestAsset ? (
          <>
            <p className="text-sm font-semibold text-foreground truncate">
              {kpis.bestAsset.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatAbsoluteValue(kpis.bestAsset.value, selectedMetricUnit)}{" "}
              {selectedMetricLabel}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">--</p>
        )}
      </div>

      {/* Worst performer */}
      <div className="p-4 rounded-xl bg-card/60 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Trailing
          </span>
        </div>
        {isLoading ? (
          <div className={shimmer} />
        ) : kpis.worstAsset ? (
          <>
            <p className="text-sm font-semibold text-foreground truncate">
              {kpis.worstAsset.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatAbsoluteValue(kpis.worstAsset.value, selectedMetricUnit)}{" "}
              {selectedMetricLabel}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">--</p>
        )}
      </div>

      {/* Dominant archetype */}
      <div className="p-4 rounded-xl bg-card/60 border border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Profile
          </span>
        </div>
        {signalsLoading ? (
          <div className={shimmer} />
        ) : kpis.dominantArchetype ? (
          <>
            <p className="text-sm font-semibold text-foreground truncate">
              {kpis.dominantArchetype}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dominant archetype
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">--</p>
        )}
      </div>
    </div>
  )
}
