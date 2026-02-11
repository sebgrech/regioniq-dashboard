"use client"

/**
 * Apple-style grouped list for portfolio assets.
 * Single rounded container, hairline dividers, minimal color accents.
 * Each row: color dot → icon → address/region/badges → chevron.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Trash2, Loader2 } from "lucide-react"
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
  /** "user" mode links to /site/[slug]?from=portfolio, "admin" to /gp/[slug] */
  mode?: "user" | "admin"
}

export function PortfolioCards({
  assets,
  visible,
  signalsMap,
  hoveredAssetIndex,
  onAssetHover,
  mode = "admin",
}: PortfolioCardsProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDelete = async (e: React.MouseEvent, assetId: string) => {
    e.preventDefault()
    e.stopPropagation()

    // First click: show confirmation
    if (confirmId !== assetId) {
      setConfirmId(assetId)
      // Auto-dismiss after 3 seconds
      setTimeout(() => setConfirmId((prev) => (prev === assetId ? null : prev)), 3000)
      return
    }

    // Second click: actually delete
    setDeletingId(assetId)
    setConfirmId(null)

    try {
      const res = await fetch(`/api/portfolio/sites?id=${assetId}`, { method: "DELETE" })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // silently fail
    } finally {
      setDeletingId(null)
    }
  }
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
            href={mode === "user" ? `/site/${asset.slug}?from=portfolio` : `/gp/${asset.slug}`}
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

            {/* Delete button (user mode only, appears on hover) */}
            {mode === "user" && (
              <button
                type="button"
                onClick={(e) => handleDelete(e, asset.id)}
                className={cn(
                  "p-1.5 rounded-lg flex-shrink-0 transition-all",
                  confirmId === asset.id
                    ? "bg-red-500/10 text-red-500 opacity-100"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                )}
                title={confirmId === asset.id ? "Click again to remove" : "Remove from portfolio"}
              >
                {deletingId === asset.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
