"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Zap,
  Users,
  TrendingUp,
  TrendingDown,
  Briefcase,
  PoundSterling,
  Activity,
  Info,
  Home,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateChange, type DataPoint } from "@/lib/data-service"

interface MetricInteractionInsightsProps {
  allMetricsData: { metricId: string; data: DataPoint[] }[]
  year: number
  regionName: string
  currentMetricId: string
  isLoading?: boolean
  /** Minimal mode - removes card chrome for embedding in OM-style layouts */
  minimal?: boolean
}

interface PatternTile {
  id: string
  title: string
  caption: string // 6-10 words max
  signal: "positive" | "neutral" | "caution"
  icon: React.ComponentType<{ className?: string }>
  delta?: string
  period?: string // e.g., "2023–24"
  metrics: string[]
}

interface YoYResult {
  value: number
  fromYear: number
  toYear: number
}

function getYoY(data: DataPoint[], targetYear: number): YoYResult | null {
  const historicalData = data
    .filter((d) => d.type === "historical" && d.year <= targetYear)
    .sort((a, b) => a.year - b.year)

  if (historicalData.length < 2) return null

  const current = historicalData[historicalData.length - 1]
  const previous = historicalData[historicalData.length - 2]

  if (!current || !previous) return null
  
  return {
    value: calculateChange(current.value, previous.value),
    fromYear: previous.year,
    toYear: current.year,
  }
}

function getLatestValue(data: DataPoint[]): number | null {
  const historical = data
    .filter((d) => d.type === "historical")
    .sort((a, b) => b.year - a.year)
  return historical[0]?.value ?? null
}

/**
 * Compute pattern tiles from cross-metric data
 * Each tile = one idea, ultra-visual
 * 
 * IMPORTANT: Uses employment density (jobs per working-age resident) as the 
 * primary structural indicator. Growth rate comparisons are secondary.
 */
function computePatterns(
  allMetricsData: { metricId: string; data: DataPoint[] }[],
  year: number
): PatternTile[] {
  const patterns: PatternTile[] = []
  const getMetric = (id: string) => allMetricsData.find((d) => d.metricId === id)?.data ?? []

  const gvaData = getMetric("nominal_gva_mn_gbp")
  const empData = getMetric("emp_total_jobs")
  const popData = getMetric("population_total")
  const incData = getMetric("gdhi_per_head_gbp")
  const empRateData = getMetric("employment_rate_pct")

  const gvaYoY = getYoY(gvaData, year)
  const empYoY = getYoY(empData, year)
  const popYoY = getYoY(popData, year)
  const incYoY = getYoY(incData, year)
  const latestEmpRate = getLatestValue(empRateData)
  
  // Calculate employment density (jobs per total population as proxy)
  // This is the KEY structural indicator for determining if a region is
  // an employment destination vs residential catchment
  const latestEmp = getLatestValue(empData)
  const latestPop = getLatestValue(popData)
  const employmentDensity = (latestEmp && latestPop && latestPop > 0) 
    ? latestEmp / latestPop 
    : null
  
  // Extreme employment hub threshold (City of London, Westminster, Canary Wharf)
  // These regions have job:population ratios far exceeding 1.0
  const isExtremeEmploymentHub = employmentDensity !== null && employmentDensity > 1.5
  const isEmploymentDestination = employmentDensity !== null && employmentDensity > 0.6
  const isResidentialCatchment = employmentDensity !== null && employmentDensity < 0.4

  // A) Major employment hub: extremely high job concentration
  // Only show this for genuine employment destinations
  if (isExtremeEmploymentHub) {
    patterns.push({
      id: "major_employment_hub",
      title: "Major employment hub",
      caption: "Draws workers from across the region",
      signal: "positive",
      icon: Briefcase,
      delta: `${employmentDensity!.toFixed(1)} jobs/resident`,
      metrics: ["emp_total_jobs", "population_total"]
    })
  }
  
  // A2) Residential catchment: only flag if employment density is genuinely low
  // This replaces the old "commuter profile" logic that used growth rates
  if (isResidentialCatchment && !isExtremeEmploymentHub) {
    patterns.push({
      id: "residential_catchment",
      title: "Residential catchment",
      caption: "Workforce likely exports to employment centres",
      signal: "neutral",
      icon: Home,
      delta: `${employmentDensity!.toFixed(2)} jobs/resident`,
      metrics: ["emp_total_jobs", "population_total"]
    })
  }

  // B) Local capture gap: income weak relative to output
  // Skip this for extreme employment hubs where low capture is structural
  if (!isExtremeEmploymentHub && gvaYoY != null && incYoY != null && gvaYoY.value > incYoY.value + 1.5) {
    patterns.push({
      id: "capture_gap",
      title: "Local capture",
      caption: "Output not fully reflected in local incomes",
      signal: "caution",
      icon: PoundSterling,
      delta: `Gap ${(gvaYoY.value - incYoY.value).toFixed(1)}pp`,
      period: `${gvaYoY.fromYear}–${gvaYoY.toYear.toString().slice(-2)}`,
      metrics: ["nominal_gva_mn_gbp", "gdhi_per_head_gbp"]
    })
  }

  // C) Consumer tailwind: GDHI growth strong + employment stable/positive
  if (incYoY != null && incYoY.value > 2 && empYoY != null && empYoY.value >= 0) {
    patterns.push({
      id: "consumer_tailwind",
      title: "Consumer tailwind",
      caption: "Household spending power improving",
      signal: "positive",
      icon: ArrowUpRight,
      delta: `Inc +${incYoY.value.toFixed(1)}%`,
      period: `${incYoY.fromYear}–${incYoY.toYear.toString().slice(-2)}`,
      metrics: ["gdhi_per_head_gbp", "emp_total_jobs"]
    })
  }

  // D) Labour reservoir: slack available + job growth weak
  // Skip for employment hubs where labour market dynamics are different
  if (!isEmploymentDestination && latestEmpRate != null && latestEmpRate < 73 && empYoY != null && empYoY.value < 1) {
    patterns.push({
      id: "labour_reservoir",
      title: "Labour reservoir",
      caption: "Expansion less constrained by hiring",
      signal: "positive",
      icon: Users,
      delta: `Rate ${latestEmpRate.toFixed(0)}%`,
      metrics: ["employment_rate_pct", "emp_total_jobs"]
    })
  }

  // E) Demand pressure: pop growth + emp growth both strong
  if (popYoY != null && popYoY.value > 1 && empYoY != null && empYoY.value > 1) {
    patterns.push({
      id: "demand_pressure",
      title: "Demand pressure",
      caption: "Demand pressure building across assets",
      signal: "caution",
      icon: TrendingUp,
      delta: `Both +${Math.min(popYoY.value, empYoY.value).toFixed(0)}%+`,
      period: `${popYoY.fromYear}–${popYoY.toYear.toString().slice(-2)}`,
      metrics: ["population_total", "emp_total_jobs"]
    })
  }

  // F) Residential pressure: pop growing faster than jobs
  // Only show if this is NOT an employment hub (where pop growth is structurally lower)
  if (!isEmploymentDestination && popYoY != null && empYoY != null && popYoY.value > empYoY.value + 1) {
    patterns.push({
      id: "residential_pressure",
      title: "Residential pressure",
      caption: "Housing demand may be building",
      signal: "neutral",
      icon: Home,
      delta: `Pop +${popYoY.value.toFixed(1)}%`,
      period: `${popYoY.fromYear}–${popYoY.toYear.toString().slice(-2)}`,
      metrics: ["population_total", "emp_total_jobs"]
    })
  }

  // G) Productivity-led (existing, tightened)
  if (gvaYoY != null && empYoY != null) {
    const diff = gvaYoY.value - empYoY.value
    if (diff > 1) {
      patterns.push({
        id: "productivity_led",
        title: "Productivity",
        caption: "Output rising faster than jobs",
        signal: "positive",
        icon: TrendingUp,
        delta: `+${diff.toFixed(1)}pp`,
        period: `${gvaYoY.fromYear}–${gvaYoY.toYear.toString().slice(-2)}`,
        metrics: ["nominal_gva_mn_gbp", "emp_total_jobs"]
      })
    } else if (diff < -1) {
      patterns.push({
        id: "labour_intensive",
        title: "Labour-intensive",
        caption: "Jobs growing faster than output",
        signal: "neutral",
        icon: Briefcase,
        delta: `${diff.toFixed(1)}pp`,
        period: `${gvaYoY.fromYear}–${gvaYoY.toYear.toString().slice(-2)}`,
        metrics: ["nominal_gva_mn_gbp", "emp_total_jobs"]
      })
    }
  }

  // H) Tight labour market
  if (latestEmpRate != null && latestEmpRate > 76 && empYoY != null && empYoY.value > 1) {
    patterns.push({
      id: "tight_labour",
      title: "Tight market",
      caption: "Hiring constraints may apply",
      signal: "caution",
      icon: Activity,
      delta: `Rate ${latestEmpRate.toFixed(0)}%`,
      metrics: ["employment_rate_pct", "emp_total_jobs"]
    })
  }

  // I) Strong momentum (fallback)
  if (patterns.length === 0 && gvaYoY != null && gvaYoY.value > 2) {
    patterns.push({
      id: "strong_momentum",
      title: "Strong momentum",
      caption: "Economic expansion continuing",
      signal: "positive",
      icon: TrendingUp,
      delta: `+${gvaYoY.value.toFixed(1)}%`,
      period: `${gvaYoY.fromYear}–${gvaYoY.toYear.toString().slice(-2)}`,
      metrics: ["nominal_gva_mn_gbp"]
    })
  }

  // J) Contraction warning
  if (gvaYoY != null && gvaYoY.value < -1) {
    patterns.push({
      id: "contraction",
      title: "Contraction",
      caption: "Output declining may precede job losses",
      signal: "caution",
      icon: TrendingDown,
      delta: `${gvaYoY.value.toFixed(1)}%`,
      period: `${gvaYoY.fromYear}–${gvaYoY.toYear.toString().slice(-2)}`,
      metrics: ["nominal_gva_mn_gbp"]
    })
  }

  return patterns
}

const signalColors = {
  positive: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  neutral: "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800/30 dark:text-slate-200 dark:border-slate-700",
  caution: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
}

const deltaPillColors = {
  positive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  neutral: "bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200",
  caution: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
}

export function MetricInteractionInsights({
  allMetricsData,
  year,
  regionName,
  currentMetricId,
  isLoading = false,
  minimal = false,
}: MetricInteractionInsightsProps) {
  const [showInfo, setShowInfo] = useState(false)
  const [showAll, setShowAll] = useState(false)
  
  const patterns = useMemo(
    () => computePatterns(allMetricsData, year),
    [allMetricsData, year]
  )

  // Show max 3 by default, rest behind "Show more"
  const visiblePatterns = showAll ? patterns : patterns.slice(0, 3)
  const hasMore = patterns.length > 3

  if (isLoading) {
    if (minimal) {
      return (
        <div className="space-y-2">
          <div className="h-14 skeleton-shimmer rounded-lg" />
          <div className="h-14 skeleton-shimmer rounded-lg" />
          <div className="h-14 skeleton-shimmer rounded-lg" />
        </div>
      )
    }
    return (
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
        <CardHeader className="pb-2 pt-3 px-5">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0 px-5">
          <div className="space-y-2">
            <div className="h-16 skeleton-shimmer rounded-xl" />
            <div className="h-16 skeleton-shimmer rounded-xl" />
            <div className="h-16 skeleton-shimmer rounded-xl" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (patterns.length === 0) {
    if (minimal) return null
    return (
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
        <CardHeader className="pb-2 pt-3 px-5">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0 px-5">
          <p className="text-sm text-muted-foreground py-2">
            No significant patterns for {regionName}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Minimal mode - no card chrome, balanced sizing for readability
  if (minimal) {
    return (
      <div className="space-y-2">
        {visiblePatterns.slice(0, 3).map((pattern, index) => {
          const Icon = pattern.icon
          return (
            <div
              key={pattern.id}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border transition-all duration-200",
                signalColors[pattern.signal],
                "animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
              )}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
            >
              <div className="p-2 rounded-lg bg-background/50 flex-shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-base">{pattern.title}</span>
                <p className="text-sm opacity-70 leading-snug mt-0.5">
                  {pattern.caption}
                </p>
              </div>
              {pattern.delta && (
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-sm font-mono font-semibold",
                    deltaPillColors[pattern.signal]
                  )}>
                    {pattern.delta}
                  </div>
                  {pattern.period && (
                    <span className="text-xs text-muted-foreground/60">{pattern.period}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
      <CardHeader className="pb-2 pt-3 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Patterns
          </CardTitle>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2.5 pb-2 pt-0 px-5">
        {visiblePatterns.map((pattern, index) => {
          const Icon = pattern.icon
          const isRelevant = pattern.metrics.includes(currentMetricId)

          return (
            <div
              key={pattern.id}
              className={cn(
                // Premium tile styling with hover lift
                "flex items-center gap-5 p-6 rounded-xl border transition-all duration-300",
                "hover:-translate-y-0.5 hover:shadow-md",
                signalColors[pattern.signal],
                isRelevant && "ring-2 ring-primary/30",
                // Staggered entrance animation
                "animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                index === 0 && "stagger-1",
                index === 1 && "stagger-2",
                index === 2 && "stagger-3"
              )}
              style={{ animationFillMode: "backwards" }}
            >
              {/* Icon - larger, more prominent */}
              <div className="p-3.5 rounded-lg bg-background/60 flex-shrink-0 shadow-sm">
                <Icon className="h-6 w-6" />
              </div>
              
              {/* Title + Caption */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xl">{pattern.title}</span>
                  {isRelevant && (
                    <Badge variant="outline" className="text-sm h-6 px-2.5 bg-primary/10 border-primary/30">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-lg opacity-75 leading-snug mt-1">
                  {pattern.caption}
                </p>
              </div>
              
              {/* Delta pill - more prominent */}
              {pattern.delta && (
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className={cn(
                    "px-4 py-2.5 rounded-lg text-lg font-mono font-semibold shadow-sm",
                    deltaPillColors[pattern.signal]
                  )}>
                    {pattern.delta}
                  </div>
                  {pattern.period && (
                    <span className="text-base text-muted-foreground/60">{pattern.period}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Show more button */}
        {hasMore && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show less" : `Show ${patterns.length - 3} more`}
            <ChevronDown className={cn(
              "h-3 w-3 ml-1 transition-transform",
              showAll && "rotate-180"
            )} />
          </Button>
        )}

        {/* Info tooltip - collapsed by default */}
        {showInfo && (
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
            Patterns computed from YoY changes. Differences &gt;0.5pp shown.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
