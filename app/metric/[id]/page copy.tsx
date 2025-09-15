"use client"

import React, { use, useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Download,
  Share,
  Bookmark,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartTimeseries } from "@/components/chart-timeseries"
import { DataTable } from "@/components/data-table"
import { MapScaffold } from "@/components/map-scaffold"
import { DashboardControls } from "@/components/dashboard-controls"
import { METRICS, REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import {
  fetchSeries,
  formatValue,
  formatPercentage,
  calculateChange,
  type DataPoint,
} from "@/lib/data-service"
import {
  getSearchParam,
  getSearchParamNumber,
  updateSearchParams,
  cn,
} from "@/lib/utils"

interface MetricDetailData {
  currentData: DataPoint[]
  allScenariosData: {
    scenario: Scenario
    data: DataPoint[]
  }[]
  allRegionsData: {
    region: string
    data: DataPoint[]
  }[]
  isLoading: boolean
}

function MetricDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params) // 👈 unwrap Promise
  const searchParams = useSearchParams()
  const router = useRouter()

  // URL state
  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  // Find the metric
  const metric = METRICS.find((m) => m.id === id)
  const selectedRegion = REGIONS.find((r) => r.code === region)

  // Data state
  const [detailData, setDetailData] = useState<MetricDetailData>({
    currentData: [],
    allScenariosData: [],
    allRegionsData: [],
    isLoading: true,
  })

  // Load detailed data
  useEffect(() => {
    const loadDetailData = async () => {
      if (!metric) return
      setDetailData((prev) => ({ ...prev, isLoading: true }))

      try {
        const currentData = await fetchSeries({ metricId: metric.id, region, scenario })

        const allScenariosPromises = (["baseline", "upside", "downside"] as const).map(
          async (s) => ({
            scenario: s,
            data: await fetchSeries({ metricId: metric.id, region, scenario: s }),
          })
        )
        const allScenariosData = await Promise.all(allScenariosPromises)

        const majorRegions = REGIONS.slice(0, 8)
        const allRegionsPromises = majorRegions.map(async (r) => ({
          region: r.code,
          data: await fetchSeries({ metricId: metric.id, region: r.code, scenario }),
        }))
        const allRegionsData = await Promise.all(allRegionsPromises)

        setDetailData({
          currentData,
          allScenariosData,
          allRegionsData,
          isLoading: false,
        })
      } catch (error) {
        console.error("Failed to load metric detail data:", error)
        setDetailData((prev) => ({ ...prev, isLoading: false }))
      }
    }

    loadDetailData()
  }, [metric, region, scenario])

  // URL update handlers
  const updateURL = (updates: Record<string, string | number | null>) => {
    const newParams = updateSearchParams(searchParams, updates)
    router.push(`/metric/${id}?${newParams}`, { scroll: false })
  }

  const handleRegionChange = (newRegion: string) => updateURL({ region: newRegion })
  const handleYearChange = (newYear: number) => updateURL({ year: newYear })
  const handleScenarioChange = (newScenario: Scenario) => updateURL({ scenario: newScenario })

  if (!metric) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Metric Not Found</h1>
          <p className="text-muted-foreground">
            The requested metric could not be found.
          </p>
          <Button asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  // … keep the rest of your component identical …
  // (Charts, Tabs, Methodology, Quick Facts, Related Metrics, etc.)
}

export default function MetricDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading metric details...</span>
          </div>
        </div>
      }
    >
      <MetricDetailContent params={params} />
    </Suspense>
  )
}
