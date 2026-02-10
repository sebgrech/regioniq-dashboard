"use client"

/**
 * Signal overview grid with:
 * - Signal dot legend at the top
 * - Asset/region rows with archetype, summary, signal dots
 * - Links to GP pages
 */

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PortfolioAssetItem, RegionSignals } from "./portfolio-types"
import {
  ASSET_COLORS,
  SIGNAL_IDS,
  SIGNAL_LABELS,
  signalDigest,
} from "./portfolio-types"

// =============================================================================
// SignalDot (inlined — small enough to live here)
// =============================================================================

function SignalDot({
  strength,
  outcome,
  detail,
}: {
  strength: 1 | 2 | 3 | 4
  outcome: string
  detail?: string
}) {
  const [showDetail, setShowDetail] = useState(false)

  const isExtreme = strength === 4
  const isGood = strength === 3
  const isCaution = strength === 2

  const dotColor = isExtreme
    ? "bg-violet-500"
    : isGood
      ? "bg-emerald-500"
      : isCaution
        ? "bg-amber-500"
        : "bg-red-500"

  const bgColor = isExtreme
    ? "bg-violet-500/10"
    : isGood
      ? "bg-emerald-500/10"
      : isCaution
        ? "bg-amber-500/10"
        : "bg-red-500/10"

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
      onClick={() => setShowDetail((p) => !p)} // mobile tap support
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full cursor-default",
          bgColor
        )}
      >
        {[1, 2, 3].map((d) => (
          <div
            key={d}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              d <= (strength === 4 ? 3 : strength)
                ? dotColor
                : "bg-current opacity-15"
            )}
          />
        ))}
        {strength === 4 && (
          <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
        )}
      </div>

      {detail && showDetail && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 px-3 py-2 rounded-lg shadow-lg text-xs text-foreground bg-popover border border-border w-max max-w-[260px] animate-in fade-in-0 zoom-in-95 duration-150">
          {detail}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Signal Legend
// =============================================================================

function SignalLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground mb-3 px-1">
      <span className="font-medium text-foreground/70">Signal strength:</span>
      {[
        { label: "Weak", color: "bg-red-500", dots: 1 },
        { label: "Moderate", color: "bg-amber-500", dots: 2 },
        { label: "Strong", color: "bg-emerald-500", dots: 3 },
        { label: "Extreme", color: "bg-violet-500", dots: 4 },
      ].map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: Math.min(item.dots, 3) }).map((_, i) => (
              <span
                key={i}
                className={cn("w-1.5 h-1.5 rounded-full", item.color)}
              />
            ))}
            {item.dots === 4 && (
              <span className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
            )}
          </span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface PortfolioSignalsProps {
  assets: PortfolioAssetItem[]
  visible: boolean[]
  signalsMap: Record<string, RegionSignals>
  signalsLoading: boolean
}

export function PortfolioSignals({
  assets,
  visible,
  signalsMap,
  signalsLoading,
}: PortfolioSignalsProps) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">
          Economic Signals
        </h3>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          Regional signals across all portfolio locations
        </p>
      </div>

      {signalsLoading ? (
        <div className="p-5 rounded-2xl bg-card/40 border border-border/30">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-full skeleton-shimmer rounded" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <SignalLegend />
          <div className="overflow-x-auto rounded-2xl bg-card/40 border border-border/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider w-[200px]">
                    Location
                  </th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider w-[120px]">
                    Archetype
                  </th>
                  <th className="text-left p-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider w-[180px]">
                    Summary
                  </th>
                  {SIGNAL_IDS.map((sid) => (
                    <th
                      key={sid}
                      className="text-center p-3 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider"
                    >
                      {SIGNAL_LABELS[sid]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => {
                  const regionSignals = signalsMap[asset.region_code]
                  const color = ASSET_COLORS[i % ASSET_COLORS.length]

                  return (
                    <tr
                      key={asset.id}
                      className={cn(
                        "border-b border-border/30 last:border-0 transition-colors",
                        visible[i] ? "hover:bg-muted/20" : "opacity-40"
                      )}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <Link
                            href={`/gp/${asset.slug}`}
                            className="text-sm font-medium text-foreground hover:text-primary truncate max-w-[170px]"
                          >
                            {asset.address}
                          </Link>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 pl-4">
                          {asset.region_name}
                        </p>
                      </td>
                      <td className="p-3">
                        {regionSignals?.archetype ? (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full text-center">
                            {regionSignals.archetype}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </td>
                      <td className="p-3">
                        {regionSignals?.signals ? (
                          <span className="text-xs text-muted-foreground italic">
                            {signalDigest(regionSignals.signals)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">--</span>
                        )}
                      </td>
                      {SIGNAL_IDS.map((sid) => {
                        const signal = regionSignals?.signals?.[sid]
                        if (!signal) {
                          return (
                            <td key={sid} className="p-3 text-center">
                              <span className="text-muted-foreground/30">
                                --
                              </span>
                            </td>
                          )
                        }
                        return (
                          <td key={sid} className="p-3 text-center">
                            <SignalDot
                              strength={signal.strength}
                              outcome={signal.outcome}
                              detail={signal.detail}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
