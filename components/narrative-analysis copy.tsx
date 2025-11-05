"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Sparkles, Clock, AlertCircle } from "lucide-react"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"
import { formatValue } from "@/lib/data-service"
import { Skeleton } from "@/components/ui/skeleton"

interface NarrativeAnalysisProps {
  region: string
  year: number
  scenario: Scenario
  allMetricsData: {
    metricId: string
    value: number
  }[]
  isLoading?: boolean
}

export function NarrativeAnalysis({
  region,
  year,
  scenario,
  allMetricsData,
  isLoading = false,
}: NarrativeAnalysisProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [narrative, setNarrative] = useState("")
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)

  const regionData = REGIONS.find((r) => r.code === region)

  const generateRegionalNarrative = () => {
    if (!regionData || !allMetricsData.length) return ""

    const populationData = allMetricsData.find((d) => d.metricId === "population")
    const gvaData = allMetricsData.find((d) => d.metricId === "gva")
    const incomeData = allMetricsData.find((d) => d.metricId === "income")
    const employmentData = allMetricsData.find((d) => d.metricId === "employment")

    const populationMetric = METRICS.find((m) => m.id === "population")
    const gvaMetric = METRICS.find((m) => m.id === "gva")
    const incomeMetric = METRICS.find((m) => m.id === "income")
    const employmentMetric = METRICS.find((m) => m.id === "employment")

    // Format values
    const popValue = formatValue(populationData?.value || 0, populationMetric?.unit || "")
    const gvaValue = formatValue(gvaData?.value || 0, gvaMetric?.unit || "")
    const incomeValue = formatValue(incomeData?.value || 0, incomeMetric?.unit || "")
    const employmentValue = formatValue(employmentData?.value || 0, employmentMetric?.unit || "")

    // Generate contextual narrative based on region and scenario
    const scenarioText =
      scenario === "upside"
        ? "optimistic growth trajectory"
        : scenario === "downside"
          ? "conservative projections"
          : "baseline forecasts"

    if (region === "UKI") {
      return `London's economy continues to outperform UK averages across all key indicators in ${year}. Population growth combines with GVA expansion to reinforce the capital's economic dominance, though employment dynamics suggest increasing productivity per worker. The ${scenarioText} project continued strength through 2030, with all metrics maintaining positive trajectories.`
    }

    return `${regionData.name}'s economic profile shows balanced performance across key indicators in ${year}. With a population of ${popValue} and GVA of ${gvaValue}, the region demonstrates ${scenario === "upside" ? "strong" : scenario === "downside" ? "cautious" : "steady"} economic fundamentals. Employment levels at ${employmentValue} and average income of ${incomeValue} reflect the region's position within the UK economic landscape under ${scenarioText}.`
  }

  useEffect(() => {
    if (!isLoading && allMetricsData.length > 0) {
      const newNarrative = generateRegionalNarrative()
      setNarrative(newNarrative)
      setLastGenerated(new Date())
    }
  }, [region, year, scenario, allMetricsData, isLoading])

  const handleRefresh = async () => {
    setIsGenerating(true)

    // TODO: Replace with actual API call
    // const response = await fetch('/api/narrative', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     region,
    //     year,
    //     scenario,
    //     metrics: {
    //       population: allMetricsData.find(d => d.metricId === "population")?.value,
    //       gva: allMetricsData.find(d => d.metricId === "gva")?.value,
    //       income: allMetricsData.find(d => d.metricId === "income")?.value,
    //       employment: allMetricsData.find(d => d.metricId === "employment")?.value
    //     }
    //   })
    // })

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newNarrative = generateRegionalNarrative()
    setNarrative(newNarrative)
    setLastGenerated(new Date())
    setIsGenerating(false)
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    return `${hours} hours ago`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isGenerating || isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Regional insights for {regionData?.name} • {year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/5" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-foreground leading-relaxed text-sm">
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating analysis...
                </span>
              ) : (
                narrative
              )}
            </p>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Powered by Claude
                </Badge>
                {lastGenerated && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Generated {formatTimeAgo(lastGenerated)}</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isGenerating}
                className="text-xs bg-transparent"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

NarrativeAnalysis.Skeleton = function NarrativeAnalysisSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="pt-3 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

NarrativeAnalysis.EmptyState = function NarrativeAnalysisEmpty({
  message = "Analysis unavailable",
}: {
  message?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          AI Analysis
        </CardTitle>
        <CardDescription>Regional insights unavailable</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-muted/20 flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground mt-1">Try refreshing or selecting different parameters</p>
        </div>
      </CardContent>
    </Card>
  )
}
