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
}

interface PatternTile {
  id: string
  title: string
  caption: string // 6-10 words max
  signal: "positive" | "neutral" | "caution"
  icon: React.ComponentType<{ className?: string }>
  delta?: string
  metrics: string[]
}

function getYoY(data: DataPoint[], targetYear: number): number | null {
  const historicalData = data
    .filter((d) => d.type === "historical" && d.year <= targetYear)
    .sort((a, b) => a.year - b.year)

  if (historicalData.length < 2) return null

  const current = historicalData[historicalData.length - 1]
  const previous = historicalData[historicalData.length - 2]

  if (!current || !previous) return null
  return calculateChange(current.value, previous.value)
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

  // A) Commuter profile: employment_density low AND pop growth > job growth
  if (popYoY != null && empYoY != null && popYoY > empYoY + 0.5) {
    patterns.push({
      id: "commuter_profile",
      title: "Commuter profile",
      caption: "Residents likely work elsewhere",
      signal: "neutral",
      icon: Users,
      delta: `Pop +${popYoY.toFixed(1)}%`,
      metrics: ["population_total", "emp_total_jobs"]
    })
  }

  // B) Local capture gap: income weak relative to output
  if (gvaYoY != null && incYoY != null && gvaYoY > incYoY + 1.5) {
    patterns.push({
      id: "capture_gap",
      title: "Local capture",
      caption: "Output not fully reflected in local incomes",
      signal: "caution",
      icon: PoundSterling,
      delta: `Gap ${(gvaYoY - incYoY).toFixed(1)}pp`,
      metrics: ["nominal_gva_mn_gbp", "gdhi_per_head_gbp"]
    })
  }

  // C) Consumer tailwind: GDHI growth strong + employment stable/positive
  if (incYoY != null && incYoY > 2 && empYoY != null && empYoY >= 0) {
    patterns.push({
      id: "consumer_tailwind",
      title: "Consumer tailwind",
      caption: "Household spending power improving",
      signal: "positive",
      icon: ArrowUpRight,
      delta: `Inc +${incYoY.toFixed(1)}%`,
      metrics: ["gdhi_per_head_gbp", "emp_total_jobs"]
    })
  }

  // D) Labour reservoir: slack available + job growth weak
  if (latestEmpRate != null && latestEmpRate < 73 && empYoY != null && empYoY < 1) {
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
  if (popYoY != null && popYoY > 1 && empYoY != null && empYoY > 1) {
    patterns.push({
      id: "demand_pressure",
      title: "Demand pressure",
      caption: "Demand pressure building across assets",
      signal: "caution",
      icon: TrendingUp,
      delta: `Both +${Math.min(popYoY, empYoY).toFixed(0)}%+`,
      metrics: ["population_total", "emp_total_jobs"]
    })
  }

  // F) Residential engine: pop growing faster than jobs
  if (popYoY != null && empYoY != null && popYoY > empYoY + 1) {
    patterns.push({
      id: "residential_engine",
      title: "Residential engine",
      caption: "Housing pressure may be building",
      signal: "neutral",
      icon: Home,
      delta: `Pop +${popYoY.toFixed(1)}%`,
      metrics: ["population_total", "emp_total_jobs"]
    })
  }

  // G) Productivity-led (existing, tightened)
  if (gvaYoY != null && empYoY != null) {
    const diff = gvaYoY - empYoY
    if (diff > 1) {
      patterns.push({
        id: "productivity_led",
        title: "Productivity",
        caption: "Output rising faster than jobs",
        signal: "positive",
        icon: TrendingUp,
        delta: `+${diff.toFixed(1)}pp`,
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
        metrics: ["nominal_gva_mn_gbp", "emp_total_jobs"]
      })
    }
  }

  // H) Tight labour market
  if (latestEmpRate != null && latestEmpRate > 76 && empYoY != null && empYoY > 1) {
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
  if (patterns.length === 0 && gvaYoY != null && gvaYoY > 2) {
    patterns.push({
      id: "strong_momentum",
      title: "Strong momentum",
      caption: "Economic expansion continuing",
      signal: "positive",
      icon: TrendingUp,
      delta: `+${gvaYoY.toFixed(1)}%`,
      metrics: ["nominal_gva_mn_gbp"]
    })
  }

  // J) Contraction warning
  if (gvaYoY != null && gvaYoY < -1) {
    patterns.push({
      id: "contraction",
      title: "Contraction",
      caption: "Output declining may precede job losses",
      signal: "caution",
      icon: TrendingDown,
      delta: `${gvaYoY.toFixed(1)}%`,
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
      
      <CardContent className="space-y-2 pb-3 pt-0 px-5">
        {visiblePatterns.map((pattern, index) => {
          const Icon = pattern.icon
          const isRelevant = pattern.metrics.includes(currentMetricId)

          return (
            <div
              key={pattern.id}
              className={cn(
                // Premium tile styling with hover lift
                "flex items-center gap-3 p-4 rounded-xl border transition-all duration-300",
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
              <div className="p-2 rounded-lg bg-background/60 flex-shrink-0 shadow-sm">
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Title + Caption */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{pattern.title}</span>
                  {isRelevant && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-primary/10 border-primary/30">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs opacity-75 leading-snug mt-0.5">
                  {pattern.caption}
                </p>
              </div>
              
              {/* Delta pill - more prominent */}
              {pattern.delta && (
                <div className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex-shrink-0 shadow-sm",
                  deltaPillColors[pattern.signal]
                )}>
                  {pattern.delta}
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
