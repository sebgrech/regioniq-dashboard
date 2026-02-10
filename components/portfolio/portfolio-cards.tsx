"use client"

/**
 * Compact asset cards — no map thumbnails.
 * Shows: icon, address, region, badges, selected metric value.
 * Hover highlights the corresponding map pin/boundary.
 */

import Link from "next/link"
import { Eye, EyeOff, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PortfolioAssetItem, RegionSignals } from "./portfolio-types"
import {
  ASSET_COLORS,
  getAssetClassIcon,
  formatAbsoluteValue,
} from "./portfolio-types"

interface PortfolioCardsProps {
  assets: PortfolioAssetItem[]
  visible: boolean[]
  signalsMap: Record<string, RegionSignals>
  selectedMetricLabel: string
  selectedMetricUnit: string
  metricValueForAsset: (index: number) => number | null
  isLoading: boolean
  toggleAsset: (index: number) => void
  hoveredAssetIndex: number | null
  onAssetHover: (index: number | null) => void
}

export function PortfolioCards({
  assets,
  visible,
  signalsMap,
  selectedMetricLabel,
  selectedMetricUnit,
  metricValueForAsset,
  isLoading,
  toggleAsset,
  hoveredAssetIndex,
  onAssetHover,
}: PortfolioCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      {assets.map((asset, i) => {
        const Icon = getAssetClassIcon(asset.asset_class)
        const color = ASSET_COLORS[i % ASSET_COLORS.length]
        const archetype = signalsMap[asset.region_code]?.archetype
        const isVisible = visible[i]
        const isHovered = hoveredAssetIndex === i
        const metricVal = metricValueForAsset(i)

        return (
          <div
            key={asset.id}
            className={cn(
              "group relative rounded-xl border transition-all",
              isVisible
                ? "bg-card border-border/60 hover:border-border hover:shadow-md"
                : "bg-muted/30 border-border/30 opacity-60 hover:opacity-80",
              isHovered && isVisible && "ring-1 ring-primary/30 shadow-md"
            )}
            style={{
              borderLeftWidth: 3,
              borderLeftColor: isVisible ? color : "transparent",
            }}
            onMouseEnter={() => onAssetHover(i)}
            onMouseLeave={() => onAssetHover(null)}
          >
            {/* Navigate to GP page */}
            <Link href={`/gp/${asset.slug}`} className="block p-3">
              <div className="flex items-start gap-2.5">
                {/* Icon */}
                <div
                  className="p-1.5 rounded-lg flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">
                    {asset.address}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{asset.region_name}</span>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {asset.asset_class && (
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded">
                        {asset.asset_class}
                      </span>
                    )}
                    {archetype && (
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded">
                        {archetype}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric value (reactive to selected metric) */}
                <div className="flex-shrink-0 text-right pl-2">
                  {isLoading ? (
                    <div className="h-4 w-12 skeleton-shimmer rounded" />
                  ) : metricVal != null ? (
                    <>
                      <p
                        className="text-sm font-bold tabular-nums"
                        style={{ color }}
                      >
                        {formatAbsoluteValue(metricVal, selectedMetricUnit)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {selectedMetricLabel}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">--</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Eye toggle */}
            <button
              className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 transition-colors"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleAsset(i)
              }}
              title={isVisible ? "Hide from charts" : "Show in charts"}
            >
              {isVisible ? (
                <Eye className="h-3 w-3 text-muted-foreground/70 hover:text-foreground transition-colors" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground/40" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
