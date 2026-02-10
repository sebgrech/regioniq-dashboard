"use client"

/**
 * Apple-style grouped list for portfolio assets.
 * Single rounded container, hairline dividers, minimal color accents.
 * Each row: color dot → icon → address/region/badges → chevron.
 */

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PortfolioAssetItem, RegionSignals } from "./portfolio-types"
import {
  ASSET_COLORS,
  getAssetClassIcon,
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
  hoveredAssetIndex,
  onAssetHover,
}: PortfolioCardsProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden divide-y divide-border/40">
      {assets.map((asset, i) => {
        const Icon = getAssetClassIcon(asset.asset_class)
        const color = ASSET_COLORS[i % ASSET_COLORS.length]
        const archetype = signalsMap[asset.region_code]?.archetype
        const isVisible = visible[i]
        const isHovered = hoveredAssetIndex === i

        return (
          <Link
            key={asset.id}
            href={`/gp/${asset.slug}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5 transition-all group animate-fade-up",
              isVisible
                ? "hover:bg-muted/40"
                : "opacity-45",
              isHovered && isVisible && "bg-muted/30"
            )}
            style={{ animationDelay: `${i * 60}ms` }}
            onMouseEnter={() => onAssetHover(i)}
            onMouseLeave={() => onAssetHover(null)}
          >
            {/* Color accent dot */}
            <span
              className={cn(
                "w-3 h-3 rounded-full flex-shrink-0 transition-all",
                isHovered && "scale-125 animate-pulse"
              )}
              style={{ backgroundColor: isVisible ? color : "#94a3b8" }}
            />

            {/* Icon */}
            <div
              className="p-1.5 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${color}08` }}
            >
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: isVisible ? color : "#94a3b8" }}
              />
            </div>

            {/* Primary: address + region + badges */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {asset.address}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {asset.region_name}
                </span>
                {asset.asset_class && (
                  <span className="text-[10px] text-muted-foreground/60">
                    · {asset.asset_class}
                  </span>
                )}
                {archetype && (
                  <span className="text-[10px] text-muted-foreground/60">
                    · {archetype}
                  </span>
                )}
              </div>
            </div>

            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
