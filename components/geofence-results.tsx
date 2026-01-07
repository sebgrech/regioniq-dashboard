"use client"

/**
 * GeofenceResults
 * 
 * Displays aggregated metrics for a geofence catchment area.
 * Shows population, GDHI, employment totals with breakdown by LAD.
 */

import { useState } from "react"
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
} from "lucide-react"
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
import type { GeofenceResult, LADContribution, Geofence } from "@/lib/geofence"
import { formatGeofenceResult } from "@/lib/geofence"
import { exportCatchmentCSV, exportCatchmentXLSX } from "@/lib/geofence/export"

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

/** LAD breakdown row */
function LADBreakdownRow({
  contribution,
  maxWeight,
}: {
  contribution: LADContribution
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
                {contribution.ladAreaKm2.toFixed(1)} km² included
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-4", compact ? "p-4 pt-2" : undefined)}>
        {/* Summary metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricSummaryCard
            title="Population"
            value={formatted.population}
            icon={Users}
            color="#3b82f6"
            compact={compact}
          />
          <MetricSummaryCard
            title="Household Income"
            value={formatted.gdhi}
            subtitle="Total GDHI"
            icon={PoundSterling}
            color="#22c55e"
            compact={compact}
          />
          <MetricSummaryCard
            title="Employment"
            value={formatted.employment}
            icon={Briefcase}
            color="#f59e0b"
            compact={compact}
          />
          <MetricSummaryCard
            title="Local Authorities"
            value={formatted.regions}
            subtitle="Contributing to estimate"
            icon={MapPin}
            color="#8b5cf6"
            compact={compact}
          />
        </div>

        {/* Methodology note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Values are area-weighted estimates based on the proportion of each
            local authority within your catchment.{" "}
            {result.breakdown.some((c) => c.weight < 1) && (
              <span className="font-medium">
                Some areas are only partially included.
              </span>
            )}
          </p>
        </div>

        {/* LAD breakdown (collapsible) */}
        {result.breakdown.length > 0 && (
          <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-2"
              >
                <span className="text-sm font-medium">
                  View breakdown by local authority
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
                  <LADBreakdownRow
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

  return (
    <div className={cn("flex flex-wrap gap-3 text-sm", className)}>
      <div className="flex items-center gap-1.5">
        <Users className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{formatted.population}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <PoundSterling className="h-4 w-4 text-green-500" />
        <span className="font-medium">{formatted.gdhi}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Briefcase className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{formatted.employment}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>{result.regions_used} LADs</span>
      </div>
    </div>
  )
}

