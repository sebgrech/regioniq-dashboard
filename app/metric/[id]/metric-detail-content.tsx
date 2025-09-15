"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
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
import { MetricDataTab } from "@/components/data" // 👈 NEW
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
  allScenariosData: { scenario: Scenario; data: DataPoint[] }[]
  allRegionsData: { region: string; data: DataPoint[] }[]
  isLoading: boolean
}

// Map UI metric ids -> Supabase metric_id (exact strings you provided)
type DbMetricId = "emp_total_jobs" | "gdhi_per_head_gbp" | "nominal_gva_mn_gbp" | "population_total"
const METRIC_ID_MAP: Record<string, DbMetricId> = {
  employment: "emp_total_jobs",
  income: "gdhi_per_head_gbp",
  gva: "nominal_gva_mn_gbp",
  population: "population_total",
}

export default function MetricDetailContent({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  const metric = METRICS.find((m) => m.id === id)
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

  const selectedRegion = REGIONS.find((r) => r.code === region)

  const [detailData, setDetailData] = useState<MetricDetailData>({
    currentData: [],
    allScenariosData: [],
    allRegionsData: [],
    isLoading: true,
  })

  useEffect(() => {
    const loadDetailData = async () => {
      setDetailData((prev) => ({ ...prev, isLoading: true }))
      try {
        const currentData = await fetchSeries({
          metricId: metric.id,
          region,
          scenario,
        })

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
  }, [metric.id, region, scenario])

  const updateURL = (updates: Record<string, string | number | null>) => {
    const newParams = updateSearchParams(searchParams, updates)
    router.push(`/metric/${id}?${newParams}`, { scroll: false })
  }

  const handleRegionChange = (newRegion: string) => updateURL({ region: newRegion })
  const handleYearChange = (newYear: number) => updateURL({ year: newYear })
  const handleScenarioChange = (newScenario: Scenario) =>
    updateURL({ scenario: newScenario })

  const currentYearData = detailData.currentData.find((d) => d.year === year)
  const previousYearData = detailData.currentData.find((d) => d.year === year - 1)
  const currentValue = currentYearData?.value || 0
  const previousValue = previousYearData?.value || 0
  const yearOverYearChange = calculateChange(currentValue, previousValue)

  const fiveYearAgoData = detailData.currentData.find((d) => d.year === year - 5)
  const fiveYearChange = fiveYearAgoData
    ? calculateChange(currentValue, fiveYearAgoData.value)
    : 0

  const Icon = metric.icon

  // Map UI metric id to Supabase metric_id for the Data tab
  const dbMetricId: DbMetricId = METRIC_ID_MAP[metric.id] ?? (metric.id as DbMetricId)

  return (
    <div className="min-h-screen bg-background">
      <DashboardControls
        region={region}
        year={year}
        scenario={scenario}
        onRegionChange={handleRegionChange}
        onYearChange={handleYearChange}
        onScenarioChange={handleScenarioChange}
      />

      {/* Header */}
      <div className="border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">{metric.title}</h1>
                    <p className="text-muted-foreground">
                      {selectedRegion?.name} • {year} • {scenario} scenario
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Stats */}
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-2xl font-bold">
                    {formatValue(currentValue, metric.unit)}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Value</div>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div>
                  <div
                    className={cn(
                      "text-2xl font-bold flex items-center gap-1",
                      yearOverYearChange >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {yearOverYearChange >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPercentage(yearOverYearChange)}
                  </div>
                  <div className="text-sm text-muted-foreground">Year-over-Year</div>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div>
                  <div
                    className={cn(
                      "text-2xl font-bold flex items-center gap-1",
                      fiveYearChange >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {fiveYearChange >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPercentage(fiveYearChange)}
                  </div>
                  <div className="text-sm text-muted-foreground">5-Year Change</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Bookmark className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-8">
          {/* 👇 now 5 tabs */}
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="regional">Regional</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger> {/* NEW */}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <ChartTimeseries
                  title={`${metric.title} Trend`}
                  description={`Historical and forecast data for ${selectedRegion?.name}`}
                  data={detailData.currentData}
                  unit={metric.unit}
                  metricId={metric.id}
                  isLoading={detailData.isLoading}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Methodology & Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-medium mb-2">Data Sources</h4>
                      <p className="text-muted-foreground">
                        Official statistics from ONS, regional agencies, and government departments.
                        Historical data spans {YEARS.min}–{YEARS.forecastStart - 1}, with forecasts to {YEARS.max}.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Calculation Method</h4>
                      <p className="text-muted-foreground">
                        {metric.id === "population" &&
                          "Mid-year population estimates with forecasts based on demographic trends and migration."}
                        {metric.id === "gva" &&
                          "Gross Value Added at current basic prices. Contribution of producers, industries, or sectors."}
                        {metric.id === "income" &&
                          "Gross Disposable Household Income per head after taxes and transfers."}
                        {metric.id === "employment" &&
                          "Total employment including employees, self-employed, and trainees (by workplace)."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <MapScaffold
                  selectedRegion={region}
                  metric={metric.id}
                  year={year}
                  scenario={scenario}
                  onRegionSelect={handleRegionChange}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Facts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detailData.isLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peak Value:</span>
                          <span className="font-medium">
                            {formatValue(
                              Math.max(...detailData.currentData.map((d) => d.value)),
                              metric.unit
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Lowest Value:</span>
                          <span className="font-medium">
                            {formatValue(
                              Math.min(...detailData.currentData.map((d) => d.value)),
                              metric.unit
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data Type:</span>
                          <Badge
                            variant={currentYearData?.type === "historical" ? "secondary" : "outline"}
                          >
                            {currentYearData?.type || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Updated:</span>
                          <span className="font-medium">Q4 2024</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Scenarios */}
          <TabsContent value="scenarios" className="space-y-8">
            <ChartTimeseries
              title={`${metric.title} - All Scenarios`}
              description={`Baseline, upside, and downside for ${selectedRegion?.name}`}
              data={detailData.allScenariosData.find((s) => s.scenario === "baseline")?.data || []}
              additionalSeries={detailData.allScenariosData
                .filter((s) => s.scenario !== "baseline")
                .map((s, i) => ({
                  scenario: s.scenario,
                  data: s.data,
                  color: `hsl(var(--chart-${i + 2}))`,
                }))}
              unit={metric.unit}
              metricId={metric.id}
              isLoading={detailData.isLoading}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {detailData.allScenariosData.map((sData) => {
                const val = sData.data.find((d) => d.year === year)?.value || 0
                const prev = sData.data.find((d) => d.year === year - 1)?.value || 0
                const change = calculateChange(val, prev)

                return (
                  <Card
                    key={sData.scenario}
                    className={cn(scenario === sData.scenario && "ring-2 ring-primary")}
                  >
                    <CardHeader>
                      <CardTitle className="capitalize">{sData.scenario} Scenario</CardTitle>
                      <CardDescription>
                        {sData.scenario === "baseline" && "Most likely projection"}
                        {sData.scenario === "upside" && "Optimistic projection"}
                        {sData.scenario === "downside" && "Conservative projection"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">{formatValue(val, metric.unit)}</div>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            change >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {formatPercentage(change)} vs previous year
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Regional */}
          <TabsContent value="regional" className="space-y-8">
            <DataTable
              title={`${metric.title} - Regional Comparison`}
              description={`Compare ${metric.title.toLowerCase()} across regions for ${year}`}
              data={detailData.allRegionsData.map((r) => ({
                region: r.region,
                metricId: metric.id,
                scenario,
                data: r.data,
              }))}
              unit={metric.unit}
              year={year}
              isLoading={detailData.isLoading}
            />
          </TabsContent>

          {/* Analysis */}
          <TabsContent value="analysis" className="space-y-8">
            {/* your analysis content unchanged */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                  <CardDescription>
                    Analysis of {metric.title.toLowerCase()} trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-1">Trend Analysis</h4>
                      <p className="text-muted-foreground">
                        {yearOverYearChange >= 0 ? "Positive" : "Negative"} trajectory observed.{" "}
                        {scenario} scenario projects{" "}
                        {yearOverYearChange >= 0 ? "continued growth" : "potential recovery"} through {YEARS.max}.
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-1">Regional Context</h4>
                      <p className="text-muted-foreground">
                        {selectedRegion?.name} shows{" "}
                        {region === "UKI" ? "above-average" : "mixed"} performance vs national averages.
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-1">Forecast Confidence</h4>
                      <p className="text-muted-foreground">
                        {year >= YEARS.forecastStart ? "Forecast" : "Historical"} data with{" "}
                        {scenario === "baseline"
                          ? "moderate"
                          : scenario === "upside"
                          ? "high optimism"
                          : "conservative"}{" "}
                        confidence.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Related Metrics</CardTitle>
                  <CardDescription>Explore connected indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {METRICS.filter((m) => m.id !== metric.id).map((rm) => {
                      const RelatedIcon = rm.icon
                      return (
                        <Link
                          key={rm.id}
                          href={`/metric/${rm.id}?region=${region}&year=${year}&scenario=${scenario}`}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <RelatedIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{rm.title}</div>
                            <div className="text-sm text-muted-foreground">View detailed analysis</div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ✅ Data (NEW) */}
          <TabsContent value="data" className="space-y-8">
            <MetricDataTab
              metricId={dbMetricId}
              region={region}
              scenario={scenario}
              title={metric.title}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
