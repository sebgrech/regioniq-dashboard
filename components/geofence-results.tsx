"use client"

/**
 * GeofenceResults
 * 
 * Displays aggregated metrics for a geofence catchment area.
 * Shows population, GDHI/income, employment, GVA totals with
 * breakdown by region (LAD or MSOA).
 */

import { useState, useMemo } from "react"
import {
  Users,
  PoundSterling,
  Briefcase,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  Loader2,
  FileText,
  FileSpreadsheet,
  Presentation,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { GeofenceResult, RegionContribution, Geofence } from "@/lib/geofence"
import { formatGeofenceResult } from "@/lib/geofence"
import { exportCatchmentCSV, exportCatchmentPPTX, exportCatchmentXLSX } from "@/lib/geofence/export"

interface GeofenceResultsProps {
  /** The geofence calculation result */
  result: GeofenceResult | null
  /** Whether calculation is in progress */
  isCalculating?: boolean
  /** Error message if calculation failed */
  error?: string | null
  /** Custom class name */
  className?: string
  /** The geofence used (for export metadata) */
  geofence?: Geofence | null
  /** Compact mode (less padding, smaller text) */
  compact?: boolean
}

/** Format a number with K/M/B suffixes */
function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

/** Format percentage */
function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

/** Metric card for displaying a single aggregated value */
function MetricSummaryCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color,
  compact,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  subtitle?: string
  color: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p
            className={cn(
              "text-muted-foreground font-medium",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {title}
          </p>
          <p className={cn("font-bold", compact ? "text-xl" : "text-2xl")}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-full p-2 flex items-center justify-center",
            compact ? "p-1.5" : "p-2"
          )}
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
        </div>
      </div>
    </div>
  )
}

/** Region breakdown row (works for both LAD and MSOA) */
function RegionBreakdownRow({
  contribution,
  maxWeight,
}: {
  contribution: RegionContribution
  maxWeight: number
}) {
  const weightPercent = (contribution.weight / maxWeight) * 100

  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className="font-mono text-xs shrink-0">
            {contribution.code}
          </Badge>
          <span className="text-sm font-medium truncate">
            {contribution.name}
          </span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge
                variant="secondary"
                className="font-mono text-xs shrink-0"
              >
                {formatPercent(contribution.weight)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {contribution.intersectionAreaKm2.toFixed(1)} km² of{" "}
                {contribution.regionAreaKm2.toFixed(1)} km² included
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Progress value={weightPercent} className="h-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{formatNumber(contribution.population)} people</span>
        <span>{formatNumber(contribution.employment)} jobs</span>
      </div>
    </div>
  )
}

// Sequential blue ramp for the income variation chart
const INCOME_COLORS = [
  "#1e3a5f", "#1e4976", "#1e588d", "#2067a4", "#2276bb",
  "#3385c6", "#4494d1", "#55a3dc", "#6bb2e7", "#82c1f2",
]

/** Income variation horizontal bar chart (MSOA only) */
function IncomeVariationChart({
  breakdown,
}: {
  breakdown: RegionContribution[]
}) {
  const chartData = useMemo(() => {
    return breakdown
      .filter((c) => c.income > 0)
      .sort((a, b) => b.income - a.income)
      .map((c) => ({
        name: c.name,
        income: Math.round(c.income),
      }))
  }, [breakdown])

  if (chartData.length < 3) return null

  const maxIncome = chartData[0]?.income ?? 0
  const minIncome = chartData[chartData.length - 1]?.income ?? 0

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between h-auto py-2"
        >
          <span className="text-sm font-medium">
            Income variation across neighbourhoods
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground mb-2">
            Household income ranges from{" "}
            <span className="font-medium">
              £{minIncome.toLocaleString()}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              £{maxIncome.toLocaleString()}
            </span>
          </div>
          <ResponsiveContainer
            width="100%"
            height={Math.min(chartData.length * 28 + 20, 400)}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `£${formatNumber(v)}`}
                fontSize={10}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                fontSize={10}
                tick={{ fill: "var(--muted-foreground)" }}
                tickLine={false}
              />
              <RechartsTooltip
                formatter={(value: number) => [
                  `£${value.toLocaleString()}`,
                  "Household Income",
                ]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="income" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => {
                  const colorIdx = Math.floor(
                    (index / Math.max(chartData.length - 1, 1)) *
                      (INCOME_COLORS.length - 1)
                  )
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={INCOME_COLORS[colorIdx]}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function GeofenceResults({
  result,
  isCalculating = false,
  error,
  className,
  geofence,
  compact = false,
}: GeofenceResultsProps) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCSV = () => {
    if (!result) return
    exportCatchmentCSV({ result, geofence })
  }

  const handleExportXLSX = async () => {
    if (!result) return
    setIsExporting(true)
    try {
      await exportCatchmentXLSX({ result, geofence })
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPPTX = async () => {
    if (!result) return
    setIsExporting(true)
    try {
      await exportCatchmentPPTX({ result, geofence })
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  // Loading state
  if (isCalculating) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className={compact ? "p-4 pb-2" : undefined}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            Calculating catchment...
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? "p-4 pt-2" : undefined}>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("border-destructive", className)}>
        <CardHeader className={compact ? "p-4 pb-2" : undefined}>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Info className="h-5 w-5" />
            Calculation Error
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? "p-4 pt-2" : undefined}>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  // No result state
  if (!result) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent
          className={cn(
            "flex flex-col items-center justify-center text-center",
            compact ? "p-6" : "p-8"
          )}
        >
          <MapPin className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Draw a catchment area on the map to see aggregated metrics
          </p>
        </CardContent>
      </Card>
    )
  }

  // Determine labels based on level
  const isMSOA = result.level === "MSOA"
  const regionLabel = isMSOA ? "Neighbourhoods" : "Local Authorities"
  const breakdownLabel = isMSOA
    ? "View breakdown by neighbourhood"
    : "View breakdown by local authority"
  const methodologyAreaLabel = isMSOA ? "neighbourhood" : "local authority"

  // Format the result
  const formatted = formatGeofenceResult(result)
  const maxWeight = Math.max(...result.breakdown.map((c) => c.weight), 0.01)

  return (
    <Card className={className}>
      <CardHeader className={cn("py-2 px-4", compact ? "py-2 px-4" : undefined)}>
        <div className="flex flex-col gap-1.5">
          {/* Top row: Title */}
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <MapPin className="h-5 w-5 text-primary" />
              Catchment Analysis
            </CardTitle>
          </div>
          {/* Bottom row: Badge + Export */}
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="shrink-0 text-xs">
              {result.year} • {result.scenario}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting} className="shrink-0 h-7 px-2">
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5 text-xs">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportXLSX}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPPTX}>
                  <Presentation className="h-4 w-4 mr-2" />
                  Export PowerPoint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-4", compact ? "p-4 pt-2" : undefined)}>
        {/* Fallback notice */}
        {result.fallbackReason && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{result.fallbackReason}</p>
          </div>
        )}

        {/* Data unavailable notice */}
        {result.dataUnavailable && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/80 border border-border text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Your catchment covers {result.regions_used}{" "}
              {isMSOA ? "neighbourhoods" : "areas"} but metric data could
              not be retrieved. Try drawing a smaller area.
            </p>
          </div>
        )}

        {/* Summary metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricSummaryCard
            title="Population"
            value={formatted.population}
            icon={Users}
            color={result.dataUnavailable ? "#9ca3af" : "#3b82f6"}
            compact={compact}
          />
          {isMSOA ? (
            <MetricSummaryCard
              title="Avg Household Income"
              value={formatted.income}
              subtitle={result.dataUnavailable ? undefined : "Population-weighted average"}
              icon={PoundSterling}
              color={result.dataUnavailable ? "#9ca3af" : "#22c55e"}
              compact={compact}
            />
          ) : (
            <MetricSummaryCard
              title="Household Income"
              value={formatted.gdhi}
              subtitle={result.dataUnavailable ? undefined : "Total GDHI"}
              icon={PoundSterling}
              color={result.dataUnavailable ? "#9ca3af" : "#22c55e"}
              compact={compact}
            />
          )}
          <MetricSummaryCard
            title="Employment"
            value={formatted.employment}
            icon={Briefcase}
            color={result.dataUnavailable ? "#9ca3af" : "#f59e0b"}
            compact={compact}
          />
          {isMSOA ? (
            <MetricSummaryCard
              title="GVA"
              value={formatted.gva}
              subtitle={result.dataUnavailable ? undefined : "Gross Value Added"}
              icon={TrendingUp}
              color={result.dataUnavailable ? "#9ca3af" : "#8b5cf6"}
              compact={compact}
            />
          ) : (
            <MetricSummaryCard
              title={regionLabel}
              value={formatted.regions}
              subtitle="Contributing to estimate"
              icon={MapPin}
              color="#8b5cf6"
              compact={compact}
            />
          )}
        </div>

        {/* MSOA: show region count as a small badge below the grid */}
        {isMSOA && !result.dataUnavailable && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{formatted.regions} contributing to estimate</span>
          </div>
        )}

        {/* Methodology note */}
        {!result.dataUnavailable && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Values are area-weighted estimates based on the proportion of each{" "}
              {methodologyAreaLabel} within your catchment.{" "}
              {result.breakdown.some((c) => c.weight < 1) && (
                <span className="font-medium">
                  Some areas are only partially included.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Income variation chart (MSOA only) */}
        {isMSOA && !result.dataUnavailable && (
          <IncomeVariationChart breakdown={result.breakdown} />
        )}

        {/* Region breakdown (collapsible) */}
        {result.breakdown.length > 0 && !result.dataUnavailable && (
          <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
              >
                <span className="text-sm font-medium">
                  {breakdownLabel}
                </span>
                {isBreakdownOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-[300px] rounded-md border p-3">
                {result.breakdown.map((contribution) => (
                  <RegionBreakdownRow
                    key={contribution.code}
                    contribution={contribution}
                    maxWeight={maxWeight}
                  />
                ))}
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact inline version for use in sidebars/panels
 */
export function GeofenceResultsInline({
  result,
  isCalculating,
  className,
}: {
  result: GeofenceResult | null
  isCalculating?: boolean
  className?: string
}) {
  if (isCalculating) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Calculating...</span>
      </div>
    )
  }

  if (!result) {
    return null
  }

  const formatted = formatGeofenceResult(result)
  const isMSOA = result.level === "MSOA"
  const regionLabel = isMSOA ? "neighbourhoods" : "LADs"

  return (
    <div className={cn("flex flex-wrap gap-3 text-sm", className)}>
      <div className="flex items-center gap-1.5">
        <Users className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{formatted.population}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <PoundSterling className="h-4 w-4 text-green-500" />
        <span className="font-medium">
          {isMSOA ? formatted.income : formatted.gdhi}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Briefcase className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{formatted.employment}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>
          {result.regions_used} {regionLabel}
        </span>
      </div>
    </div>
  )
}
