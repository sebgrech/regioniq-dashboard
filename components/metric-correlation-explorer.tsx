"use client"

import React, { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { METRICS } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react"

interface MetricCorrelationExplorerProps {
  regionName: string
  year: number
  scenario: string
  allMetricsSeriesData: {
    metricId: string
    data: { year: number; value: number }[]
  }[]
}

interface SeriesPoint {
  year: number
  value: number
}

interface CorrelationResult {
  r: number
  strength: "weak" | "moderate" | "strong"
  direction: "positive" | "negative" | "none"
}

interface CorrelationPair {
  metricA: string
  metricB: string
  correlation: CorrelationResult
}

// Get series data for a metric, filtered to last 15 years
function getSeries(
  metricId: string,
  allMetricsSeriesData: MetricCorrelationExplorerProps["allMetricsSeriesData"],
  currentYear: number
): SeriesPoint[] {
  const metricData = allMetricsSeriesData.find((d) => d.metricId === metricId)
  if (!metricData) return []

  const minYear = Math.max(currentYear - 14, Math.min(...metricData.data.map((d) => d.year)))
  return metricData.data
    .filter((d) => d.year >= minYear && d.year <= currentYear)
    .map((d) => ({ year: d.year, value: d.value }))
    .sort((a, b) => a.year - b.year)
}

// Compute Pearson correlation coefficient
function computePearsonCorrelation(seriesA: SeriesPoint[], seriesB: SeriesPoint[]): number {
  // Align by year
  const yearMapA = new Map(seriesA.map((p) => [p.year, p.value]))
  const yearMapB = new Map(seriesB.map((p) => [p.year, p.value]))

  const aligned: { a: number; b: number }[] = []
  for (const year of yearMapA.keys()) {
    if (yearMapB.has(year)) {
      const a = yearMapA.get(year)!
      const b = yearMapB.get(year)!
      if (isFinite(a) && isFinite(b)) {
        aligned.push({ a, b })
      }
    }
  }

  if (aligned.length < 3) return 0

  const n = aligned.length
  const sumA = aligned.reduce((acc, p) => acc + p.a, 0)
  const sumB = aligned.reduce((acc, p) => acc + p.b, 0)
  const meanA = sumA / n
  const meanB = sumB / n

  let numerator = 0
  let sumSqA = 0
  let sumSqB = 0

  for (const p of aligned) {
    const diffA = p.a - meanA
    const diffB = p.b - meanB
    numerator += diffA * diffB
    sumSqA += diffA * diffA
    sumSqB += diffB * diffB
  }

  const denominator = Math.sqrt(sumSqA * sumSqB)
  if (denominator === 0) return 0

  return numerator / denominator
}

// Classify correlation strength and direction
function classifyCorrelation(r: number): CorrelationResult {
  const absR = Math.abs(r)
  let strength: "weak" | "moderate" | "strong"
  if (absR < 0.3) {
    strength = "weak"
  } else if (absR < 0.6) {
    strength = "moderate"
  } else {
    strength = "strong"
  }

  let direction: "positive" | "negative" | "none"
  if (absR < 0.1) {
    direction = "none"
  } else if (r > 0) {
    direction = "positive"
  } else {
    direction = "negative"
  }

  return { r, strength, direction }
}

// Get color class for correlation value
function getCorrelationColor(r: number): string {
  const absR = Math.abs(r)
  if (absR < 0.1) {
    return "bg-neutral-200 dark:bg-neutral-800"
  }
  if (r > 0) {
    // Positive: warm tones (orange/pink gradient)
    if (absR > 0.6) return "bg-orange-500 dark:bg-orange-600"
    if (absR > 0.3) return "bg-orange-300 dark:bg-orange-500"
    return "bg-orange-100 dark:bg-orange-400/30"
  } else {
    // Negative: cool tones (blue gradient)
    if (absR > 0.6) return "bg-blue-500 dark:bg-blue-600"
    if (absR > 0.3) return "bg-blue-300 dark:bg-blue-500"
    return "bg-blue-100 dark:bg-blue-400/30"
  }
}

// Get short label for metric
function getMetricLabel(metricId: string): string {
  const metric = METRICS.find((m) => m.id === metricId)
  return metric?.shortTitle || metric?.title || metricId
}

export function MetricCorrelationExplorer({
  regionName,
  year,
  scenario,
  allMetricsSeriesData,
}: MetricCorrelationExplorerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Define metrics to analyze
  const metrics = ["nominal_gva_mn_gbp", "emp_total_jobs", "population_total", "gdhi_per_head_gbp"]

  // Compute all correlations
  const correlations = useMemo(() => {
    const results: Record<string, Record<string, CorrelationResult>> = {}

    for (let i = 0; i < metrics.length; i++) {
      const metricA = metrics[i]
      const seriesA = getSeries(metricA, allMetricsSeriesData, year)

      if (seriesA.length < 3) continue

      results[metricA] = {}

      for (let j = 0; j < metrics.length; j++) {
        const metricB = metrics[j]
        if (metricA === metricB) {
          results[metricA][metricB] = { r: 1, strength: "strong", direction: "positive" }
          continue
        }

        const seriesB = getSeries(metricB, allMetricsSeriesData, year)
        if (seriesB.length < 3) continue

        const r = computePearsonCorrelation(seriesA, seriesB)
        results[metricA][metricB] = classifyCorrelation(r)
      }
    }

    return results
  }, [allMetricsSeriesData, year])

  // Key pairs to highlight
  const keyPairs: CorrelationPair[] = useMemo(() => {
    const pairs: CorrelationPair[] = []

    // GVA ↔ Total Employment
    const gvaJobs = correlations["nominal_gva_mn_gbp"]?.["emp_total_jobs"]
    if (gvaJobs) {
      pairs.push({
        metricA: "nominal_gva_mn_gbp",
        metricB: "emp_total_jobs",
        correlation: gvaJobs,
      })
    }

    // Population ↔ GDHI per head
    const popIncome = correlations["population_total"]?.["gdhi_per_head_gbp"]
    if (popIncome) {
      pairs.push({
        metricA: "population_total",
        metricB: "gdhi_per_head_gbp",
        correlation: popIncome,
      })
    }

    // GVA ↔ GDHI per head
    const gvaIncome = correlations["nominal_gva_mn_gbp"]?.["gdhi_per_head_gbp"]
    if (gvaIncome) {
      pairs.push({
        metricA: "nominal_gva_mn_gbp",
        metricB: "gdhi_per_head_gbp",
        correlation: gvaIncome,
      })
    }

    return pairs
  }, [correlations])

  // Check if we have enough data
  const hasEnoughData = useMemo(() => {
    return Object.keys(correlations).length > 0 && keyPairs.length > 0
  }, [correlations, keyPairs])

  if (!hasEnoughData) {
    return (
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Metric Relationships</CardTitle>
          <CardDescription className="text-xs">
            Correlation insights will appear once enough historical data is loaded.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Metric Relationships</CardTitle>
          <CardDescription className="text-xs">
            How your core indicators move together over time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Left: Mini 3x3 heatmap */}
            <div className="flex-shrink-0">
              <div className="grid grid-cols-4 gap-[2px]">
                {/* Header row */}
                <div className="text-xs font-medium text-muted-foreground text-center py-1"></div>
                {metrics.map((m) => (
                  <div
                    key={m}
                    className="text-xs font-medium text-muted-foreground text-center py-1 truncate"
                    title={getMetricLabel(m)}
                  >
                    {getMetricLabel(m).slice(0, 4)}
                  </div>
                ))}
                {/* Data rows */}
                {metrics.map((metricA) => {
                  const row = correlations[metricA]
                  if (!row) return null
                  return (
                    <React.Fragment key={metricA}>
                      <div className="text-xs font-medium text-muted-foreground text-right pr-2 py-1 truncate">
                        {getMetricLabel(metricA).slice(0, 4)}
                      </div>
                      {metrics.map((metricB) => {
                        const corr = row[metricB]
                        if (!corr) {
                          return (
                            <div
                              key={metricB}
                              className="w-8 h-8 rounded-[3px] bg-neutral-100 dark:bg-neutral-900"
                            />
                          )
                        }
                        return (
                          <div
                            key={metricB}
                            className={cn(
                              "w-8 h-8 rounded-[3px]",
                              metricA === metricB
                                ? "bg-neutral-300 dark:bg-neutral-700"
                                : getCorrelationColor(corr.r)
                            )}
                            title={`${getMetricLabel(metricA)} ↔ ${getMetricLabel(metricB)}: r = ${corr.r.toFixed(2)}`}
                          />
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Right: Text summaries */}
            <div className="flex-1 space-y-2">
              {keyPairs.map((pair, idx) => {
                const metricA = METRICS.find((m) => m.id === pair.metricA)
                const metricB = METRICS.find((m) => m.id === pair.metricB)
                const { correlation } = pair

                let icon = Minus
                let iconColor = "text-muted-foreground"
                if (correlation.direction === "positive") {
                  icon = TrendingUp
                  iconColor = "text-green-600 dark:text-green-400"
                } else if (correlation.direction === "negative") {
                  icon = TrendingDown
                  iconColor = "text-red-600 dark:text-red-400"
                }

                const IconComponent = icon
                return (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">
                      {metricA?.shortTitle || metricA?.title} ↔ {metricB?.shortTitle || metricB?.title}
                    </span>
                    :{" "}
                    <span className="font-semibold">
                      {correlation.strength} {correlation.direction}
                    </span>{" "}
                    correlation (r = {correlation.r.toFixed(2)})
                    <IconComponent className={cn("h-3 w-3 inline ml-1", iconColor)} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer link */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-xs h-8"
            >
              View full correlation matrix
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal with full matrix */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Correlation Matrix – {regionName}, {year} {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Pearson correlation coefficients (r) between key economic indicators. Values range from -1 (perfect negative) to +1 (perfect positive).
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Full correlation matrix */}
            <div className="overflow-x-auto">
              <div className="grid grid-cols-5 gap-1 min-w-max">
                {/* Header row */}
                <div className="text-xs font-semibold text-muted-foreground p-2"></div>
                {metrics.map((m) => (
                  <div
                    key={m}
                    className="text-xs font-semibold text-muted-foreground p-2 text-center"
                  >
                    {getMetricLabel(m)}
                  </div>
                ))}
                {/* Data rows */}
                {metrics.map((metricA) => {
                  const row = correlations[metricA]
                  if (!row) return null
                  return (
                    <React.Fragment key={metricA}>
                      <div className="text-xs font-medium text-muted-foreground p-2 text-right pr-3">
                        {getMetricLabel(metricA)}
                      </div>
                      {metrics.map((metricB) => {
                        const corr = row[metricB]
                        if (!corr) {
                          return (
                            <div
                              key={metricB}
                              className="w-16 h-16 rounded-md bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center"
                            >
                              <span className="text-xs text-muted-foreground">—</span>
                            </div>
                          )
                        }
                        return (
                          <div
                            key={metricB}
                            className={cn(
                              "w-16 h-16 rounded-md flex flex-col items-center justify-center text-xs font-medium",
                              metricA === metricB
                                ? "bg-neutral-300 dark:bg-neutral-700"
                                : getCorrelationColor(corr.r)
                            )}
                            title={`${getMetricLabel(metricA)} ↔ ${getMetricLabel(metricB)}: r = ${corr.r.toFixed(3)}`}
                          >
                            <span className={cn(
                              "text-[10px]",
                              Math.abs(corr.r) < 0.1 ? "text-muted-foreground" : "text-foreground"
                            )}>
                              {corr.r.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="text-xs font-medium text-muted-foreground mb-2">Correlation Strength</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 via-neutral-300 to-orange-500" />
                <div className="text-xs text-muted-foreground flex gap-4">
                  <span>-1</span>
                  <span>0</span>
                  <span>+1</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Weak:</span> |r| &lt; 0.3 •{" "}
                <span className="font-medium">Moderate:</span> 0.3 ≤ |r| &lt; 0.6 •{" "}
                <span className="font-medium">Strong:</span> |r| ≥ 0.6
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

