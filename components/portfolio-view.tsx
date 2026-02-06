"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import Link from "next/link"
import Image from "next/image"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import {
  Building2,
  MapPin,
  Briefcase,
  ShoppingBag,
  Home,
  Dumbbell,
  Warehouse,
  UtensilsCrossed,
  TrendingUp,
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries } from "@/lib/data-service"
import { cn } from "@/lib/utils"
import { CompanyLogo } from "@/components/company-logo"
import type { PortfolioAssetItem } from "@/app/admin/portfolio/page"

// =============================================================================
// Constants
// =============================================================================

const METRICS = [
  { id: "gdhi_per_head_gbp", label: "Income per Head", unit: "£" },
  { id: "nominal_gva_mn_gbp", label: "GVA", unit: "£m" },
  { id: "emp_total_jobs", label: "Employment", unit: "jobs" },
  { id: "population_total", label: "Population", unit: "" },
]

const SIGNAL_IDS = [
  "employment_density",
  "income_capture",
  "labour_capacity",
  "productivity_strength",
  "growth_composition",
] as const

const SIGNAL_LABELS: Record<string, string> = {
  employment_density: "Job Draw",
  income_capture: "Income Retention",
  labour_capacity: "Workforce",
  productivity_strength: "Productivity",
  growth_composition: "Growth Balance",
}

// 8-color palette from compare page (Linear/Stripe inspired)
const ASSET_COLORS = [
  "#6366f1", // Indigo
  "#0ea5e9", // Sky blue
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#84cc16", // Lime
]

// =============================================================================
// Helpers
// =============================================================================

function getAssetClassIcon(assetClass: string | null): LucideIcon {
  if (!assetClass) return Building2
  const normalized = assetClass.toLowerCase().trim()
  switch (normalized) {
    case "retail": return ShoppingBag
    case "office": return Briefcase
    case "residential": return Home
    case "leisure": return Dumbbell
    case "industrial": return Warehouse
    case "f&b": case "food & beverage": case "restaurant": return UtensilsCrossed
    default: return Building2
  }
}

/** Truncate address for chart legends */
function shortAddress(address: string, max = 28): string {
  if (address.length <= max) return address
  return address.slice(0, max - 1).trimEnd() + "\u2026"
}

/** Resolve DB region code to the UI code used by fetchSeries */
function resolveUiRegionCode(dbCode: string): string {
  const match = REGIONS.find((r) => r.dbCode === dbCode)
  return match?.code ?? dbCode
}

// =============================================================================
// Types
// =============================================================================

interface AssetSeriesData {
  regionCode: string // UI code
  data: { year: number; value: number; type?: "historical" | "forecast" }[]
}

interface SignalData {
  outcome: "high" | "low" | "neutral" | "rising" | "falling" | "extreme" | "extreme_high" | "extreme_low"
  strength: 1 | 2 | 3 | 4
  detail: string
}

interface RegionSignals {
  archetype: string | null
  signals: Record<string, SignalData>
}

// =============================================================================
// Format helpers (recycled from GPComparisonSection)
// =============================================================================

function formatAbsoluteValue(value: number, unit: string): string {
  if (unit === "£") {
    return `\u00A3${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  } else if (unit === "£m") {
    if (value >= 1000) return `\u00A3${(value / 1000).toFixed(1)}bn`
    return `\u00A3${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}m`
  } else if (unit === "jobs") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return value.toLocaleString()
  } else {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return value.toLocaleString()
  }
}

// =============================================================================
// Main Component
// =============================================================================

interface PortfolioViewProps {
  assets: PortfolioAssetItem[]
  /** Server-side owner filter from ?owner= URL param */
  ownerFilter?: string | null
  /** All unique owners across the full dataset (for the dropdown) */
  allOwners?: string[]
}

export function PortfolioView({ assets, ownerFilter, allOwners = [] }: PortfolioViewProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  const textColor = isDarkMode ? "#9ca3af" : "#6b7280"

  // ---- State ----
  const [selectedMetric, setSelectedMetric] = useState(METRICS[0].id)
  const [scenario, setScenario] = useState<Scenario>("baseline")
  const [visible, setVisible] = useState<boolean[]>(() => assets.map(() => true))
  const [seriesMap, setSeriesMap] = useState<Record<string, AssetSeriesData>>({})
  const [signalsMap, setSignalsMap] = useState<Record<string, RegionSignals>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [signalsLoading, setSignalsLoading] = useState(true)

  const year = new Date().getFullYear()
  const selectedMetricConfig = METRICS.find((m) => m.id === selectedMetric)!

  // ---- Derived: unique region codes across all assets ----
  const uniqueRegions = useMemo(() => {
    const map = new Map<string, string>() // dbCode -> uiCode
    assets.forEach((a) => {
      if (!map.has(a.region_code)) {
        map.set(a.region_code, resolveUiRegionCode(a.region_code))
      }
    })
    return map
  }, [assets])

  // ---- Visible assets ----
  const visibleAssets = useMemo(
    () => assets.filter((_, i) => visible[i]),
    [assets, visible]
  )

  // ---- Toggle visibility ----
  const toggleAsset = useCallback((index: number) => {
    setVisible((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }, [])

  // =========================================================================
  // Data Fetching: series (re-fetch on metric/scenario change)
  // =========================================================================

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const results: Record<string, AssetSeriesData> = {}

      // Fetch in parallel for each unique region
      const entries = Array.from(uniqueRegions.entries())
      await Promise.all(
        entries.map(async ([dbCode, uiCode]) => {
          try {
            const raw = await fetchSeries({
              metricId: selectedMetric,
              region: uiCode,
              scenario,
            })
            const processed = raw
              .filter((d) => d.year >= year - 10 && d.year <= year + 10)
              .sort((a, b) => a.year - b.year)
              .map((d) => ({ year: d.year, value: d.value, type: d.type }))
            results[dbCode] = { regionCode: uiCode, data: processed }
          } catch {
            // skip region on error
          }
        })
      )

      if (!cancelled) {
        setSeriesMap(results)
        setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMetric, scenario, uniqueRegions, year])

  // =========================================================================
  // Data Fetching: region-insights (signals) -- once on mount + scenario change
  // =========================================================================

  useEffect(() => {
    let cancelled = false
    async function loadSignals() {
      setSignalsLoading(true)
      const results: Record<string, RegionSignals> = {}

      const entries = Array.from(uniqueRegions.entries())
      await Promise.all(
        entries.map(async ([dbCode, uiCode]) => {
          try {
            const res = await fetch("/api/region-insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ regionCode: uiCode, year, scenario }),
            })
            if (res.ok) {
              const data = await res.json()
              const signals: Record<string, SignalData> = {}
              if (data?.ui?.signals) {
                for (const s of data.ui.signals) {
                  signals[s.id] = {
                    outcome: s.outcome,
                    strength: s.strength,
                    detail: s.detail,
                  }
                }
              }
              results[dbCode] = {
                archetype: data?.ui?.bucketLabel ?? null,
                signals,
              }
            }
          } catch {
            // skip
          }
        })
      )

      if (!cancelled) {
        setSignalsMap(results)
        setSignalsLoading(false)
      }
    }
    loadSignals()
    return () => { cancelled = true }
  }, [uniqueRegions, year, scenario])

  // =========================================================================
  // Chart Data: indexed line chart (recycled from GPComparisonSection)
  // =========================================================================

  // Base year = last historical year across all visible assets
  const baseYear = useMemo(() => {
    let maxHist = 2024
    visibleAssets.forEach((a) => {
      const series = seriesMap[a.region_code]
      if (!series) return
      series.data.forEach((d) => {
        if ((d.type === "historical" || (d.type == null && d.year < 2025)) && d.year > maxHist) {
          maxHist = d.year
        }
      })
    })
    return maxHist
  }, [visibleAssets, seriesMap])

  const forecastStartYear = baseYear

  // Base values per asset (value at base year)
  const baseValues = useMemo(() => {
    const bases: Record<number, number> = {} // asset index -> base value
    assets.forEach((a, i) => {
      const series = seriesMap[a.region_code]
      if (!series) return
      const pt = series.data.find((d) => d.year === baseYear)
      if (pt) bases[i] = pt.value
    })
    return bases
  }, [assets, seriesMap, baseYear])

  // Indexed chart data
  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, any>>()

    visibleAssets.forEach((a) => {
      const globalIdx = assets.indexOf(a)
      const series = seriesMap[a.region_code]
      if (!series) return
      const base = baseValues[globalIdx]
      if (!base) return

      series.data.forEach((pt) => {
        if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
        const row = yearMap.get(pt.year)!
        const indexed = (pt.value / base) * 100
        const isForecast = pt.type === "forecast" || pt.year >= forecastStartYear

        if (isForecast) {
          row[`a${globalIdx}_fcst`] = indexed
          if (pt.year === forecastStartYear) row[`a${globalIdx}_hist`] = indexed
        } else {
          row[`a${globalIdx}_hist`] = indexed
        }
      })
    })

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [assets, visibleAssets, seriesMap, baseValues, forecastStartYear])

  // Y-axis domain
  const yDomain = useMemo(() => {
    const allValues: number[] = []
    chartData.forEach((row) => {
      Object.entries(row).forEach(([key, val]) => {
        if (key !== "year" && val != null) allValues.push(val as number)
      })
    })
    if (allValues.length === 0) return [95, 105]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.08
    return [
      Math.floor((min - padding) / 2) * 2,
      Math.ceil((max + padding) / 2) * 2,
    ]
  }, [chartData])

  // Bar chart data (absolute values at base year)
  const barData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = []
    visibleAssets.forEach((a) => {
      const globalIdx = assets.indexOf(a)
      const series = seriesMap[a.region_code]
      if (!series) return
      const pt = series.data.find((d) => d.year === baseYear)
      if (pt) {
        data.push({
          name: shortAddress(a.address),
          value: pt.value,
          color: ASSET_COLORS[globalIdx % ASSET_COLORS.length],
        })
      }
    })
    return data.sort((a, b) => b.value - a.value)
  }, [assets, visibleAssets, seriesMap, baseYear])

  // =========================================================================
  // Tooltips (recycled from GPComparisonSection)
  // =========================================================================

  const LineTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null
      const isForecast = label > forecastStartYear

      // Deduplicate
      const uniqueEntries = new Map<string, { name: string; value: number; color: string }>()
      payload.forEach((entry: any) => {
        if (entry.value == null) return
        const idxMatch = entry.dataKey.match(/^a(\d+)/)
        if (!idxMatch) return
        const idx = parseInt(idxMatch[1], 10)
        const name = shortAddress(assets[idx]?.address ?? "Asset")
        if (!uniqueEntries.has(name)) {
          uniqueEntries.set(name, {
            name,
            value: entry.value,
            color: ASSET_COLORS[idx % ASSET_COLORS.length],
          })
        }
      })

      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
          <p className="font-semibold text-foreground mb-1">
            {label}{" "}
            {isForecast && (
              <span className="text-muted-foreground font-normal">(forecast)</span>
            )}
          </p>
          {Array.from(uniqueEntries.values()).map((entry, i) => (
            <p key={i} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      )
    },
    [assets, forecastStartYear]
  )

  const BarTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.length) return null
      const data = payload[0]?.payload
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
          <p className="font-semibold text-foreground mb-1">{data?.name}</p>
          <p style={{ color: data?.color }}>
            {selectedMetricConfig.label}:{" "}
            {formatAbsoluteValue(data?.value, selectedMetricConfig.unit)}
          </p>
          <p className="text-muted-foreground mt-1">As of {baseYear}</p>
        </div>
      )
    },
    [selectedMetricConfig, baseYear]
  )

  // =========================================================================
  // Render
  // =========================================================================

  const barHeight = Math.max(120, barData.length * 32 + 40)

  // ---- Owner dropdown state ----
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* ---- Header ---- */}
      <div className="mb-8">
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
                    Portfolio &middot; {assets.length} asset{assets.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Generic heading (when no filter) */}
            {!ownerFilter && (
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Portfolio Comparison
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Cross-asset economic comparison &middot; {assets.length} assets
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Owner filter dropdown */}
            {allOwners.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOwnerDropdownOpen((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                    ownerFilter
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/50 border-border/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ownerFilter && (
                    <CompanyLogo
                      name={ownerFilter}
                      size={18}
                      showFallback={false}
                      className="rounded"
                    />
                  )}
                  <span>{ownerFilter ?? "All Owners"}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {ownerDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setOwnerDropdownOpen(false)}
                    />
                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] animate-in fade-in-0 zoom-in-95 duration-150">
                      {/* "All" option */}
                      <Link
                        href="/admin/portfolio"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                          !ownerFilter
                            ? "text-primary font-medium"
                            : "text-foreground"
                        )}
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
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                            ownerFilter === o
                              ? "text-primary font-medium"
                              : "text-foreground"
                          )}
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

            {/* Clear filter chip (when filtered) */}
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

            {/* Scenario toggle */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              {(["baseline", "upside", "downside"] as Scenario[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                    scenario === s
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Section A: Asset Summary Strip                                      */}
      {/* ================================================================== */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-3">
          {assets.map((asset, i) => {
            const Icon = getAssetClassIcon(asset.asset_class)
            const color = ASSET_COLORS[i % ASSET_COLORS.length]
            const archetype = signalsMap[asset.region_code]?.archetype
            const isVisible = visible[i]

            return (
              <button
                key={asset.id}
                onClick={() => toggleAsset(i)}
                className={cn(
                  "group relative flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                  isVisible
                    ? "bg-card border-border/60 hover:border-border"
                    : "bg-muted/30 border-border/30 opacity-60 hover:opacity-80"
                )}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: isVisible ? color : "transparent",
                }}
              >
                <div
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {asset.address}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{asset.region_name}</span>
                  </div>
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
                <div className="absolute top-2 right-2">
                  {isVisible ? (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Section B: Cross-Asset Indexed Charts                               */}
      {/* ================================================================== */}
      <div className="space-y-6 mb-10">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Cross-Asset Comparison
            </h3>
            <p className="text-sm text-muted-foreground">
              All assets indexed from {baseYear} = 100 &middot;{" "}
              <span className="capitalize">{scenario}</span> scenario
            </p>
          </div>
        </div>

        {/* Metric toggle */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map((metric) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                selectedMetric === metric.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {metric.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="h-4 w-28 skeleton-shimmer rounded" />
            <div className="h-[280px] w-full skeleton-shimmer rounded" />
            <div className="flex gap-4">
              <div className="h-2 w-20 skeleton-shimmer rounded" />
              <div className="h-2 w-16 skeleton-shimmer rounded" />
            </div>
          </div>
        )}

        {/* Charts */}
        {!isLoading && chartData.length > 0 && (
          <div className="space-y-6 p-5 rounded-xl bg-card/50 border border-border/30">
            {/* ---- Line chart (indexed) ---- */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {selectedMetricConfig.label}{" "}
                  <span className="font-normal">
                    (indexed to {baseYear} = 100)
                  </span>
                </span>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStroke}
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 10, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                    />
                    <YAxis
                      domain={yDomain}
                      tick={{ fontSize: 10, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                      width={35}
                    />
                    <RechartsTooltip content={<LineTooltip />} />
                    <ReferenceLine
                      y={100}
                      stroke={gridStroke}
                      strokeDasharray="2 2"
                    />
                    {/* Forecast divider */}
                    <ReferenceLine
                      x={forecastStartYear}
                      stroke={textColor}
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                      label={{
                        value: "Forecast",
                        position: "insideTopLeft",
                        fontSize: 9,
                        fill: textColor,
                        opacity: 0.7,
                        dx: 4,
                      }}
                    />

                    {/* One line pair (hist + fcst) per visible asset */}
                    {visibleAssets.map((a) => {
                      const idx = assets.indexOf(a)
                      const color = ASSET_COLORS[idx % ASSET_COLORS.length]
                      return [
                        <Line
                          key={`a${idx}_hist`}
                          type="monotone"
                          dataKey={`a${idx}_hist`}
                          name={shortAddress(a.address)}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                        />,
                        <Line
                          key={`a${idx}_fcst`}
                          type="monotone"
                          dataKey={`a${idx}_fcst`}
                          name={`${shortAddress(a.address)} (F)`}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={false}
                          strokeDasharray="5 3"
                          activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                        />,
                      ]
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] px-1 mt-3">
                {visibleAssets.map((a) => {
                  const idx = assets.indexOf(a)
                  const color = ASSET_COLORS[idx % ASSET_COLORS.length]
                  return (
                    <span key={a.id} className="flex items-center gap-2">
                      <span
                        className="w-4 h-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-foreground font-medium">
                        {shortAddress(a.address, 22)}
                      </span>
                      <span className="text-muted-foreground/60">
                        ({a.region_name})
                      </span>
                    </span>
                  )
                })}
                <span className="flex items-center gap-1.5 ml-auto text-muted-foreground/70">
                  <span className="w-3 border-t border-dashed border-muted-foreground" />
                  <span>forecast</span>
                </span>
              </div>
            </div>

            {/* ---- Bar chart (absolute at base year) ---- */}
            {barData.length > 0 && (
              <div className="pt-4 border-t border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {baseYear} {selectedMetricConfig.label} Comparison
                  </span>
                </div>
                <div style={{ height: barHeight }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStroke}
                        opacity={0.3}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: textColor }}
                        axisLine={{ stroke: gridStroke }}
                        tickLine={{ stroke: gridStroke }}
                        tickFormatter={(v) =>
                          formatAbsoluteValue(v, selectedMetricConfig.unit)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 9, fill: textColor }}
                        axisLine={{ stroke: gridStroke }}
                        tickLine={false}
                        width={180}
                      />
                      <RechartsTooltip
                        content={<BarTooltip />}
                        cursor={{
                          fill: isDarkMode
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.05)",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={24}
                      >
                        {barData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            opacity={0.9}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && chartData.length === 0 && (
          <div className="p-6 rounded-xl bg-muted/30 border border-border/30 text-center">
            <p className="text-sm text-muted-foreground">
              No data available. Select at least one asset above.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Section C: Signal Overview Grid                                     */}
      {/* ================================================================== */}
      <div className="mb-10">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Economic Signal Overview
          </h3>
          <p className="text-sm text-muted-foreground">
            Regional signals across all portfolio assets
          </p>
        </div>

        {signalsLoading ? (
          <div className="p-4 rounded-xl bg-card/50 border border-border/30">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-full skeleton-shimmer rounded" />
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card/50 border border-border/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground w-[200px]">
                    Asset
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground w-[120px]">
                    Archetype
                  </th>
                  {SIGNAL_IDS.map((sid) => (
                    <th
                      key={sid}
                      className="text-center p-3 text-xs font-medium text-muted-foreground"
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
                        "border-b border-border/50 last:border-0 transition-colors",
                        visible[i]
                          ? "hover:bg-muted/20"
                          : "opacity-50"
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
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full">
                            {regionSignals.archetype}
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
                              <span className="text-muted-foreground/30">--</span>
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
        )}
      </div>
    </div>
  )
}

// =============================================================================
// SignalDot - compact signal indicator for the grid
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
  // strength === 1 is "bad"

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
              d <= (strength === 4 ? 3 : strength) ? dotColor : "bg-current opacity-15"
            )}
          />
        ))}
        {strength === 4 && (
          <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
        )}
      </div>

      {/* Tooltip */}
      {detail && showDetail && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 px-3 py-2 rounded-lg shadow-lg text-xs text-foreground bg-popover border border-border w-max max-w-[260px] animate-in fade-in-0 zoom-in-95 duration-150">
          {detail}
        </div>
      )}
    </div>
  )
}
