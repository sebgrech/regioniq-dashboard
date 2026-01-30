"use client"

/**
 * DemandContextCard
 * 
 * Compact card showing the top 2 sector-relevant demand metrics.
 * Positioned to the right of the signal pills in AssetEconomicContext.
 */

import { useMemo } from "react"
import type { TenantSector } from "@/lib/tenant-sector"
import { getSectorDemandMetrics } from "@/lib/sector-demand-metrics"
import { cn } from "@/lib/utils"
import type { SignalForUI } from "@/components/asset-economic-context"

interface DemandContextCardProps {
  /** The inferred tenant sector */
  sector: TenantSector
  /** All signals from the region-insights API */
  signals: SignalForUI[]
  /** Region name for display */
  regionName: string
  /** Optional class name */
  className?: string
}

/**
 * Map signal IDs to displayable metric values.
 * Extracts numeric values from signal details.
 */
function extractMetricFromSignals(
  signals: SignalForUI[],
  metricId: string
): { value: number | null; detail: string | null } {
  // Map our metric IDs to signal IDs
  const signalIdMap: Record<string, string> = {
    employment_density: "employment_density",
    gdhi_per_head_gbp: "income_capture", // Income is captured in income_capture signal
    gva_per_job: "productivity_strength",
    employment_rate_pct: "labour_capacity",
    income_retention: "income_capture",
    population_total: "growth_composition",
    population_growth_5yr: "growth_composition",
  }

  const signalId = signalIdMap[metricId]
  if (!signalId) return { value: null, detail: null }

  const signal = signals.find(s => s.id === signalId)
  if (!signal) return { value: null, detail: null }

  // Extract numeric value from signal detail
  // Details are formatted like "0.53 jobs per working-age resident" or "£28,450 per head"
  const detail = signal.detail

  // Try to extract the first number from the detail
  const numMatch = detail.match(/[\d,]+\.?\d*/)
  if (numMatch) {
    const numStr = numMatch[0].replace(/,/g, "")
    const value = parseFloat(numStr)
    if (!isNaN(value)) {
      return { value, detail }
    }
  }

  return { value: null, detail }
}

/**
 * Get a strength indicator based on signal outcome
 */
function getStrengthIndicator(signals: SignalForUI[], relatedSignalId: string): {
  level: "strong" | "moderate" | "weak" | null
  color: string
} {
  const signal = signals.find(s => s.id === relatedSignalId)
  if (!signal) return { level: null, color: "" }

  if (signal.strength >= 4) {
    return { level: "strong", color: "text-emerald-500" }
  } else if (signal.strength >= 3) {
    return { level: "moderate", color: "text-amber-500" }
  } else if (signal.strength >= 2) {
    return { level: "weak", color: "text-muted-foreground" }
  }
  return { level: null, color: "" }
}

export function DemandContextCard({
  sector,
  signals,
  regionName,
  className,
}: DemandContextCardProps) {
  const config = useMemo(() => getSectorDemandMetrics(sector), [sector])

  // Extract primary metric
  const primaryData = useMemo(() => {
    const { detail } = extractMetricFromSignals(signals, config.primary.id)
    return { detail }
  }, [signals, config.primary.id])

  // Extract secondary metric
  const secondaryData = useMemo(() => {
    const { detail } = extractMetricFromSignals(signals, config.secondary.id)
    return { detail }
  }, [signals, config.secondary.id])

  // Get strength indicators
  const primaryStrength = useMemo(() => {
    const signalIdMap: Record<string, string> = {
      employment_density: "employment_density",
      gdhi_per_head_gbp: "income_capture",
      gva_per_job: "productivity_strength",
      employment_rate_pct: "labour_capacity",
      income_retention: "income_capture",
    }
    return getStrengthIndicator(signals, signalIdMap[config.primary.id] || "")
  }, [signals, config.primary.id])

  // If we don't have any signal data, don't render
  if (!primaryData.detail && !secondaryData.detail) {
    return null
  }

  return (
    <div
      className={cn(
        "w-52 shrink-0 rounded-xl border border-border/40 bg-muted/20 p-3",
        "animate-in fade-in-0 slide-in-from-right-2 duration-500",
        className
      )}
    >
      {/* Header */}
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2.5">
        Demand Context
      </div>

      {/* Primary metric */}
      {primaryData.detail && (
        <div className="mb-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold text-foreground leading-tight">
              {primaryData.detail}
            </span>
            {primaryStrength.level && (
              <span className={cn("text-[9px] font-medium", primaryStrength.color)}>
                {primaryStrength.level}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {config.primary.label}
          </div>
          <div className="text-[9px] text-muted-foreground/70">
            {config.primary.relevance}
          </div>
        </div>
      )}

      {/* Divider */}
      {primaryData.detail && secondaryData.detail && (
        <div className="border-t border-border/30 my-2" />
      )}

      {/* Secondary metric */}
      {secondaryData.detail && (
        <div>
          <div className="text-sm font-medium text-foreground leading-tight">
            {secondaryData.detail}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {config.secondary.label}
          </div>
          <div className="text-[9px] text-muted-foreground/70">
            {config.secondary.relevance}
          </div>
        </div>
      )}
    </div>
  )
}
