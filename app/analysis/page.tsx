"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { getSearchParam, getSearchParamNumber } from "@/lib/utils"

// Analysis tab components (same as metric detail page)
import { PlaceInsights } from "@/components/place-insights"
import { NotableFlags } from "@/components/notable-flags"
import { MetricInteractionInsights } from "@/components/metric-interaction-insights"
import { ScenarioRobustness } from "@/components/scenario-robustness"

function AnalysisPageContent() {
  const searchParams = useSearchParams()

  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  const selectedRegion = REGIONS.find((r) => r.code === region)

  // Store all metrics data for category calculation
  const [allMetricsData, setAllMetricsData] = useState<{
    metricId: string
    data: DataPoint[]
  }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load all metrics needed for analysis
  useEffect(() => {
    const loadAllMetrics = async () => {
      setIsLoading(true)
      try {
        const categoryMetricIds = [
          "population_total",
          "nominal_gva_mn_gbp",
          "gdhi_per_head_gbp",
          "emp_total_jobs",
        ] as const

        const categoryMetrics = await Promise.all(
          categoryMetricIds.map(async (metricId) => ({
            metricId,
            data: await fetchSeries({ metricId, region, scenario }),
          }))
        )

        setAllMetricsData(categoryMetrics)
      } catch (error) {
        console.error("Failed to load category metrics:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadAllMetrics()
  }, [region, scenario])

  return (
    <div className="min-h-screen bg-background">
      {/* Header - matches DashboardControls layout */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-2 flex items-center">
          {/* Logo */}
          <div className="relative h-12 w-12 flex-shrink-0">
            <Image
              src="/x.png"
              alt="RegionIQ"
              fill
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/Frame 11.png"
              alt="RegionIQ"
              fill
              className="object-contain hidden dark:block"
              priority
            />
          </div>

          <div className="flex items-center gap-4 ml-4">
            <Button variant="ghost" size="sm" asChild className="h-8 px-3">
              <Link href={`/?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}>
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Dashboard
              </Link>
            </Button>

            <div className="h-10 w-px bg-border" />

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-lg font-semibold">Full Analysis</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* PlaceInsights - PRIMARY: Place-level truth (3 canonical questions) */}
          <PlaceInsights
            regionCode={region}
            regionName={selectedRegion?.name ?? region}
            year={year}
            scenario={scenario}
            expanded
          />

          {/* Two-column layout: Notable Flags | Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notable Flags - Place-specific exceptional observations */}
            <NotableFlags
              regionCode={region}
              regionName={selectedRegion?.name ?? region}
              year={year}
              allMetricsData={allMetricsData}
              isLoading={isLoading || allMetricsData.length === 0}
            />

            {/* Metric Interaction Insights - Cross-metric computed patterns */}
            <MetricInteractionInsights
              allMetricsData={allMetricsData}
              year={year}
              regionName={selectedRegion?.name ?? region}
              currentMetricId="population_total"
              isLoading={isLoading || allMetricsData.length === 0}
            />
          </div>

          {/* Scenario Robustness - lightweight signal stability indicator */}
          <ScenarioRobustness
            regionCode={region}
            year={year}
            scenario={scenario}
          />
        </div>
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading Analysis...</span>
          </div>
        </div>
      }
    >
      <AnalysisPageContent />
    </Suspense>
  )
}
