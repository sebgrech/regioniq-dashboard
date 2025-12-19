"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExportableTimeseries } from "@/components/exportable-timeseries"
import { MapScaffold } from "@/components/map-scaffold"
import { DashboardControls } from "@/components/dashboard-controls"
import { MetricDataTab } from "@/components/data" // 👈 NEW
import { METRICS, REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import { PoliticalSummary } from "@/components/political-summary"
import { getAvailableYears } from "@/lib/elections"
import { partyColor, formatSeatSentence, type ConstituencyResult } from "@/lib/politics"
import { WestminsterHeadline } from "@/components/westminster-headline"
import { getPoliticalContext, type PoliticalContext } from "@/lib/political-context"
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
import type { RegionMetadata } from "@/components/region-search"
import { RegionRanking } from "@/components/region-ranking"
import { RegionalContextTab } from "@/components/regional-context-tab"
// Analysis tab components
import { PlaceInsights } from "@/components/place-insights"
import { NotableFlags } from "@/components/notable-flags"
import { MetricInteractionInsights } from "@/components/metric-interaction-insights"

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

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
  // Scenario comes from URL (to preserve dashboard selection), but we omit `scenario=baseline` from the slug.
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  // Track active tab for conditional UI rendering
  const [activeTab, setActiveTab] = useState("overview")

  const regionConfig = REGIONS.find((r) => r.code === region)
  const [mapLevel, setMapLevel] = useState<RegionLevel>((regionConfig?.level as RegionLevel) ?? "ITL1")
  const [selectedRegionMetadata, setSelectedRegionMetadata] = useState<RegionMetadata | null>(null)
  const [regionIndex, setRegionIndex] = useState<
    Record<string, Omit<RegionMetadata, "code">> | null
  >(null)

  // Load region index on mount (used for bbox + canonical level so the map can auto-fit on initial load)
  useEffect(() => {
    fetch("/processed/region-index.json")
      .then((res) => res.json())
      .then((data) => setRegionIndex(data))
      .catch((err) => {
        console.error("Failed to load region index:", err)
      })
  }, [])

  // If the URL region changes (via share link / browser nav), snap map level to that region’s level.
  useEffect(() => {
    const cfg = REGIONS.find((r) => r.code === region)
    if (cfg?.level) {
      setMapLevel(cfg.level as RegionLevel)
    }
    // Metadata might be stale after URL-driven change; we'll repopulate from regionIndex below.
    setSelectedRegionMetadata(null)
  }, [region])

  // Keep selectedRegionMetadata in sync with the URL region so the map can auto-zoom like the dashboard.
  useEffect(() => {
    if (!regionIndex || !region) return
    const metadata = regionIndex[region]
    if (!metadata) return

    setSelectedRegionMetadata((prev) => {
      if (prev?.code === region) return prev
      return {
        code: region,
        name: metadata.name,
        level: metadata.level,
        bbox: metadata.bbox,
      }
    })
  }, [regionIndex, region])

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
            <Link
              href={`/?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}
            >
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const selectedRegion = REGIONS.find((r) => r.code === region)
  const isLad = selectedRegion?.level === "LAD"
  const isNIEmployment = metric.id === "emp_total_jobs" && selectedRegion?.country === "Northern Ireland"

  // Political context (works for LAD, City, ITL2, ITL3, ITL1)
  const [politicalContext, setPoliticalContext] = useState<PoliticalContext | null>(null)
  const [politicalLoading, setPoliticalLoading] = useState(false)

  const [detailData, setDetailData] = useState<MetricDetailData>({
    currentData: [],
    allScenariosData: [],
    allRegionsData: [],
    isLoading: true,
  })

  // Store all metrics data for category calculation (independent of current metric)
  const [allMetricsData, setAllMetricsData] = useState<{
    metricId: string
    data: DataPoint[]
  }[]>([])

  // Store related metrics data (for employment: employment rate, unemployment rate)
  const [relatedMetricsData, setRelatedMetricsData] = useState<{
    metricId: string
    data: DataPoint[]
  }[]>([])

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

  // Load only the metrics needed for region category calculation (keeps region switching responsive).
  useEffect(() => {
    const loadAllMetrics = async () => {
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
      }
    }
    loadAllMetrics()
  }, [region, scenario])

  // Load related metrics if this metric has them (e.g., employment -> employment rate, unemployment rate)
  useEffect(() => {
    const loadRelatedMetrics = async () => {
      if (!metric.relatedMetrics || metric.relatedMetrics.length === 0) {
        setRelatedMetricsData([])
        return
      }

      try {
        const relatedPromises = metric.relatedMetrics.map(async (relatedMetricId) => {
          const relatedMetric = METRICS.find((m) => m.id === relatedMetricId)
          if (!relatedMetric) return null

          const data = await fetchSeries({
            metricId: relatedMetricId,
            region,
            scenario,
          })
          return {
            metricId: relatedMetricId,
            data,
          }
        })

        const related = (await Promise.all(relatedPromises)).filter(
          (r): r is { metricId: string; data: DataPoint[] } => r !== null
        )
        setRelatedMetricsData(related)
      } catch (error) {
        console.error("Failed to load related metrics:", error)
        setRelatedMetricsData([])
      }
    }

    loadRelatedMetrics()
  }, [metric.relatedMetrics, region, scenario])

  // Load political context (works for all region types)
  useEffect(() => {
    if (!region) {
      setPoliticalContext(null)
      return
    }

    let mounted = true
    setPoliticalLoading(true)

    console.log(`[Political Context] Loading data for region: ${region} (${selectedRegion?.name})`)

    getPoliticalContext(region)
      .then((context) => {
        if (!mounted) return
        console.log(`[Political Context] Loaded context for ${region}:`, context?.type, context?.westminsterSeats.length, "seats")
        setPoliticalContext(context)
      })
      .catch((error) => {
        console.error("[Political Context] Failed to load political context:", error)
        if (mounted) {
          setPoliticalContext(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setPoliticalLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [region, selectedRegion])

  const updateURL = (updates: Record<string, string | number | null>) => {
    const newParams = updateSearchParams(searchParams, updates)
    router.push(`/metric/${id}?${newParams}`, { scroll: false })
  }

  const handleRegionChange = (metadata: RegionMetadata) => {
    setSelectedRegionMetadata(metadata)
    setMapLevel(metadata.level as RegionLevel)
    updateURL({ region: metadata.code })
  }
  const handleYearChange = (newYear: number) => updateURL({ year: newYear })
  const handleScenarioChange = (newScenario: Scenario) =>
    updateURL({ scenario: newScenario === "baseline" ? null : newScenario })

  // Headline stats should use the latest available *historical* year (not forecast),
  // falling back to the latest year present if types are missing.
  const asOf = useMemo(() => {
    const histYears = detailData.currentData
      .filter((d) => d.type === "historical")
      .map((d) => d.year)
    if (histYears.length) return { year: Math.max(...histYears), source: "historical" as const }

    const allYears = detailData.currentData.map((d) => d.year)
    if (allYears.length) return { year: Math.max(...allYears), source: "latest" as const }

    // Fallback to URL year if we have no data yet (loading / empty series)
    return { year, source: "latest" as const }
  }, [detailData.currentData, year])

  const asOfYear = asOf.year
  const currentYearData = detailData.currentData.find((d) => d.year === asOfYear)
  const previousYearData = detailData.currentData.find((d) => d.year === asOfYear - 1)
  const currentValue = currentYearData?.value || 0
  const previousValue = previousYearData?.value || 0
  const yearOverYearChange = calculateChange(currentValue, previousValue)

  const fiveYearAgoData = detailData.currentData.find((d) => d.year === asOfYear - 5)
  const fiveYearChange = fiveYearAgoData
    ? calculateChange(currentValue, fiveYearAgoData.value)
    : 0

  const Icon = metric.icon

  // Map UI metric id to Supabase metric_id for the Data tab
  const dbMetricId: DbMetricId = METRIC_ID_MAP[metric.id] ?? (metric.id as DbMetricId)

  const scenarioMilestones = useMemo(() => {
    const desired = [2025, 2030, 2035, 2040]
    return desired.filter((y) => y >= YEARS.min && y <= YEARS.max)
  }, [])

  const scenarioComparisonRows = useMemo(() => {
    const baselineSeries =
      detailData.allScenariosData.find((s) => s.scenario === "baseline")?.data ?? []
    const upsideSeries =
      detailData.allScenariosData.find((s) => s.scenario === "upside")?.data ?? []
    const downsideSeries =
      detailData.allScenariosData.find((s) => s.scenario === "downside")?.data ?? []

    const getValue = (series: DataPoint[], y: number) =>
      series.find((d) => d.year === y)?.value

    return scenarioMilestones.map((y) => {
      const baseline = getValue(baselineSeries, y)
      const upside = getValue(upsideSeries, y)
      const downside = getValue(downsideSeries, y)

      const upsideDelta = baseline != null && upside != null ? upside - baseline : null
      const downsideDelta = baseline != null && downside != null ? downside - baseline : null

      const upsidePct = baseline != null && upside != null ? calculateChange(upside, baseline) : null
      const downsidePct =
        baseline != null && downside != null ? calculateChange(downside, baseline) : null

      const spread = upside != null && downside != null ? upside - downside : null
      const spreadPct =
        baseline != null && spread != null ? calculateChange(baseline + spread, baseline) : null

      return {
        year: y,
        baseline,
        upside,
        downside,
        upsideDelta,
        downsideDelta,
        upsidePct,
        downsidePct,
        spread,
        spreadPct,
      }
    })
  }, [detailData.allScenariosData, scenarioMilestones])

  const scenarioComparisonScale = useMemo(() => {
    const values: number[] = []
    for (const r of scenarioComparisonRows) {
      if (r.downside != null) values.push(r.downside)
      if (r.baseline != null) values.push(r.baseline)
      if (r.upside != null) values.push(r.upside)
    }
    if (!values.length) return { min: 0, max: 1 }
    const min = Math.min(...values)
    const max = Math.max(...values)
    // Prevent divide-by-zero
    if (min === max) return { min: min - 1, max: max + 1 }
    return { min, max }
  }, [scenarioComparisonRows])

  const posPct = (value: number) => {
    const { min, max } = scenarioComparisonScale
    return ((value - min) / (max - min)) * 100
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardControls
        region={region}
        year={year}
        scenario={scenario}
        onRegionChange={handleRegionChange}
        onYearChange={handleYearChange}
        onScenarioChange={handleScenarioChange}
        activeTab={activeTab}
      />

      {/* Header */}
      <div className="border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}>
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
                    <p className="text-muted-foreground text-xl">
                      {selectedRegion?.name}
                      {activeTab !== "overview" && activeTab !== "scenarios" && activeTab !== "analysis" && ` • ${year}`}
                      {activeTab === "scenarios"
                        ? " • all scenarios"
                        : activeTab !== "analysis" && ` • ${scenario} scenario`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Stats */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {asOf.source === "historical"
                    ? `Latest actual data (${asOfYear})`
                    : `Latest available data (${asOfYear})`}
                </div>

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
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
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
                {/* Main metric chart */}
                <ExportableTimeseries
                  filenameBase={`regioniq_${metric.id}_${region}_${scenario}_trend`}
                  exportMeta={{
                    Metric: metric.title,
                    Region: selectedRegion?.name ?? region,
                    "Region Code": region,
                  }}
                  title={`${metric.title} Trend`}
                  description={`Historical and forecast data for ${selectedRegion?.name}`}
                  data={detailData.currentData}
                  primaryScenario={scenario}
                  unit={metric.unit}
                  metricId={metric.id}
                  isLoading={detailData.isLoading}
                  disableZoom={true}
                />

                {/* Related metrics (e.g., Employment Rate, Unemployment Rate for Employment) */}
                {relatedMetricsData.length > 0 && (
                  <div className="space-y-6">
                    <div className="border-t border-border/40 pt-6">
                      <h3 className="text-lg font-semibold mb-4">
                        {id === "emp_total_jobs" 
                          ? "Related Labour Market Indicators"
                          : id === "population_total"
                          ? "Related Population Indicators"
                          : "Related Indicators"}
                      </h3>
                      <div className="space-y-6">
                        {relatedMetricsData.map((relatedMetric) => {
                          const relatedMetricConfig = METRICS.find((m) => m.id === relatedMetric.metricId)
                          if (!relatedMetricConfig) return null

                          return (
                            <ExportableTimeseries
                              key={relatedMetric.metricId}
                              filenameBase={`regioniq_${relatedMetric.metricId}_${region}_${scenario}_trend`}
                              exportMeta={{
                                Metric: relatedMetricConfig.title,
                                Region: selectedRegion?.name ?? region,
                                "Region Code": region,
                              }}
                              title={relatedMetricConfig.title}
                              description={`${relatedMetricConfig.title} for ${selectedRegion?.name}`}
                              data={relatedMetric.data}
                              primaryScenario={scenario}
                              unit={relatedMetricConfig.unit}
                              metricId={relatedMetric.metricId}
                              isLoading={detailData.isLoading}
                              disableZoom={true}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Regional Ranking Component - only show for metrics without related charts (GDHI, GVA) */}
                {(!metric.relatedMetrics || metric.relatedMetrics.length === 0) && (
                  <RegionRanking
                    metricId={metric.id}
                    region={region}
                    year={year}
                    scenario={scenario}
                  />
                )}

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
                        {(() => {
                          // Calculate the last historical year from actual data
                          const historicalData = detailData.currentData.filter(d => d.type === "historical")
                          const lastHistoricalYear = historicalData.length > 0 
                            ? Math.max(...historicalData.map(d => d.year))
                            : YEARS.forecastStart - 1
                          const firstHistoricalYear = historicalData.length > 0
                            ? Math.min(...historicalData.map(d => d.year))
                            : YEARS.min
                          
                          if (metric.id === "population_total") {
                            return `ONS Mid-Year Population Estimates. Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                          }
                          if (metric.id === "nominal_gva_mn_gbp") {
                            return `ONS Regional Accounts. Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                          }
                          if (metric.id === "gdhi_per_head_gbp") {
                            return `ONS Regional Accounts. Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                          }
                          if (metric.id === "emp_total_jobs") {
                            if (isNIEmployment) {
                              return `NISRA. Source: Business Register and Employment Survey (BRES). Figures exclude agriculture (but include animal husbandry service activities and hunting, trapping and game propagation). Figures may not sum due to rounding. See the BRES quality and methodology report on the NISRA website. Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                            }
                            return `ONS Business Register and Employment Survey (BRES). Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                          }
                          if (metric.id === "employment_rate_pct") {
                            return `NOMIS dataset NM_17_5 (Annual Population Survey - APS). Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}. Employment rate is defined for ages 16–64.`
                          }
                          if (metric.id === "unemployment_rate_pct") {
                            return `NOMIS dataset NM_17_5 (Annual Population Survey - APS). Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}. Unemployment rate is defined for ages 16+ (economically active).`
                          }
                          return `Official statistics from ONS, regional agencies, and government departments. Historical data spans ${firstHistoricalYear}–${lastHistoricalYear}, with forecasts to ${YEARS.max}.`
                        })()}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Calculation Method</h4>
                      <p className="text-muted-foreground">
                        {metric.id === "population_total" &&
                          "Total number of people living in the area, regardless of age. Based on ONS Mid-Year Population Estimates, residence-based (where people live). Includes all residents from newborns to the oldest members of the population."}
                        {metric.id === "nominal_gva_mn_gbp" &&
                          "Gross Value Added (GVA) is the value generated by economic units producing goods and services, less the cost of inputs used. GVA measures economic output and activity in an area at current prices. GVA + taxes on products - subsidies = GDP."}
                        {metric.id === "gdhi_per_head_gbp" &&
                          "Gross Disposable Household Income (GDHI) is total income for all individuals in the household sector (traditional households, institutions, and sole trader enterprises) after taxes and transfers. GDHI per head divides total GDHI by total population to give GBP per person, not per household."}
                        {metric.id === "emp_total_jobs" &&
                          (isNIEmployment
                            ? "Total number of employee and self-employed jobs located in the area (workplace-based). Source: Business Register and Employment Survey (BRES) as published by NISRA. Figures exclude agriculture (but include animal husbandry service activities and hunting, trapping and game propagation). Figures may not sum due to rounding."
                            : "Total number of employee and self-employed jobs located in the area. Based on Business Register and Employment Survey (BRES), workplace-based (where jobs are located, not where workers live). A person with multiple jobs counts as multiple jobs.")}
                        {metric.id === "employment_rate_pct" &&
                          "Employment rate (%): the percentage of people aged 16–64 who are in employment (employees or self-employed). Source: NOMIS dataset NM_17_5 (Annual Population Survey - APS)."}
                        {metric.id === "unemployment_rate_pct" &&
                          "Unemployment rate (%): the percentage of economically active people aged 16 and over who are unemployed. Source: NOMIS dataset NM_17_5 (Annual Population Survey - APS)."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <div className="h-[500px]">
                <MapScaffold
                  selectedRegion={region}
                  selectedRegionMetadata={selectedRegionMetadata}
                  metric={metric.id}
                  year={year}
                  scenario={scenario}
                  level={mapLevel}
                  onLevelChange={setMapLevel}
                  onRegionSelect={handleRegionChange}
                  mapId="metric-map"
                  headerSubtitle={
                    selectedRegion?.name ? `${selectedRegion.name} (${region})` : region
                  }
                    showRegionInfo={false}
                    // ⬆️ Hide region info bubble on detail page - single region context
                  />
                </div>

                {/* Political Context - Show for all region types */}
                {politicalContext && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-2xl">Political Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {politicalLoading ? (
                        <div className="text-sm text-muted-foreground">Loading political context...</div>
                      ) : politicalContext ? (
                        <>
                          {/* SECTION A — Westminster Representation (Parliamentary Layer) - PRIMARY */}
                          <div className="space-y-4 pb-6 border-b border-border/60">
                            <div className="text-sm font-bold uppercase tracking-wide text-foreground">
                              WESTMINSTER REPRESENTATION
                            </div>
                            
                            <WestminsterHeadline
                              seats={Object.entries(politicalContext.seatCounts)
                                .sort(([, a], [, b]) => b - a)
                                .map(([party, count]) => ({
                                  party,
                                  count,
                                  color: partyColor(party),
                                }))}
                              turnout={politicalContext.turnout}
                              majority={politicalContext.majority}
                              leadingParty={politicalContext.leadingParty}
                              electionYear={2024}
                              viewResultsUrl={`/westminster/${region}?return=${encodeURIComponent(
                                `/metric/${id}?region=${region}&year=${year}${
                                  scenario !== "baseline" ? `&scenario=${scenario}` : ""
                                }`
                              )}`}
                              regionType={politicalContext.type}
                            />
                          </div>

                          {/* SECTION B — Local Governance (Council Layer) - SECONDARY */}
                          <div className="space-y-4 pt-6">
                            <div className="text-sm font-bold uppercase tracking-wide text-foreground">
                              LOCAL GOVERNANCE CONTEXT
                            </div>
                            
                            {/* Local Authority Control Summary (for aggregated regions) */}
                            {politicalContext.type !== "lad" && politicalContext.ladCount > 1 && (
                              <div>
                                <div className="text-xs text-muted-foreground mb-2">
                                  Local authority control ({politicalContext.ladCount} LADs):
                                </div>
                              {(() => {
                                const total = 
                                  politicalContext.localControlSummary.LabourControlled +
                                  politicalContext.localControlSummary.ConservativeControlled +
                                  politicalContext.localControlSummary.NoOverallControl +
                                  politicalContext.localControlSummary.LiberalDemocratControlled +
                                  politicalContext.localControlSummary.GreenControlled +
                                  politicalContext.localControlSummary.ReformUKControlled +
                                  politicalContext.localControlSummary.OtherControlled
                                
                                if (total === 0) {
                                  return (
                                    <div className="text-sm text-muted-foreground">
                                      No local elections in the past two years
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div className="space-y-1 text-sm">
                                    {politicalContext.localControlSummary.LabourControlled > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.LabourControlled} Labour-controlled LAD{politicalContext.localControlSummary.LabourControlled !== 1 ? "s" : ""}
                                      </div>
                                    )}
                                    {politicalContext.localControlSummary.ConservativeControlled > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.ConservativeControlled} Conservative-controlled LAD{politicalContext.localControlSummary.ConservativeControlled !== 1 ? "s" : ""}
                                      </div>
                                    )}
                                    {politicalContext.localControlSummary.NoOverallControl > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.NoOverallControl} No Overall Control
                                      </div>
                                    )}
                                    {politicalContext.localControlSummary.LiberalDemocratControlled > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.LiberalDemocratControlled} Liberal Democrat-controlled LAD{politicalContext.localControlSummary.LiberalDemocratControlled !== 1 ? "s" : ""}
                                      </div>
                                    )}
                                    {politicalContext.localControlSummary.GreenControlled > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.GreenControlled} Green-controlled LAD{politicalContext.localControlSummary.GreenControlled !== 1 ? "s" : ""}
                                      </div>
                                    )}
                                    {politicalContext.localControlSummary.ReformUKControlled > 0 && (
                                      <div>
                                        {politicalContext.localControlSummary.ReformUKControlled} Reform UK-controlled LAD{politicalContext.localControlSummary.ReformUKControlled !== 1 ? "s" : ""}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                              </div>
                            )}

                            {/* Local Authority Control (for single LAD) */}
                            {politicalContext.type === "lad" && (
                              <div>
                                {(() => {
                                  const availableYears = getAvailableYears(region)
                                  const mostRecentYear = availableYears.length > 0 ? Math.max(...availableYears) : null
                                  if (!mostRecentYear) {
                                    return (
                                      <div className="text-sm text-muted-foreground">
                                        No local elections in the past two years
                                      </div>
                                    )
                                  }
                                  
                                  return <PoliticalSummary ladCode={region} year={mostRecentYear} />
                                })()}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No political context data available for this area.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}


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
            <ExportableTimeseries
              filenameBase={`regioniq_${metric.id}_${region}_all-scenarios`}
              exportMeta={{
                Metric: metric.title,
                Region: selectedRegion?.name ?? region,
                "Region Code": region,
              }}
              title={`${metric.title} - All Scenarios`}
              description={`Baseline, upside, and downside for ${selectedRegion?.name}`}
              data={detailData.allScenariosData.find((s) => s.scenario === "baseline")?.data || []}
              additionalSeries={useMemo(() => 
                detailData.allScenariosData
                .filter((s) => s.scenario !== "baseline")
                .map((s, i) => ({
                  scenario: s.scenario,
                  data: s.data,
                  color: `hsl(var(--chart-${i + 2}))`,
                  })),
                [detailData.allScenariosData]
              )}
              unit={metric.unit}
              metricId={metric.id}
              isLoading={detailData.isLoading}
              height={420}
            />

            <Card>
                    <CardHeader>
                <CardTitle>Scenario comparison at key milestones</CardTitle>
                      <CardDescription>
                  Risk band (downside→upside) with baseline marker, plus values and deltas vs baseline.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Risk band</TableHead>
                      <TableHead>Spread</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Upside</TableHead>
                      <TableHead>Δ vs baseline</TableHead>
                      <TableHead>Downside</TableHead>
                      <TableHead>Δ vs baseline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarioComparisonRows.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">{row.year}</TableCell>

                        <TableCell className="w-[220px]">
                          {row.downside == null || row.baseline == null || row.upside == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="relative h-3 w-[200px]">
                              {/* Track */}
                              <div className="absolute inset-0 rounded-full bg-muted" />

                              {/* Range (downside -> upside) */}
                              <div
                                className="absolute top-0 h-3 rounded-full bg-primary/30"
                                style={{
                                  left: `${posPct(row.downside)}%`,
                                  width: `${Math.max(0, posPct(row.upside) - posPct(row.downside))}%`,
                                }}
                              />

                              {/* Baseline marker */}
                              <div
                                className="absolute top-[-2px] h-[16px] w-[2px] bg-primary"
                                style={{ left: `${posPct(row.baseline)}%` }}
                              />
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          {row.spread == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="font-medium">
                              {formatValue(row.spread, metric.unit)}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          {row.baseline == null ? "—" : formatValue(row.baseline, metric.unit)}
                        </TableCell>

                        <TableCell>
                          {row.upside == null ? "—" : formatValue(row.upside, metric.unit)}
                        </TableCell>

                        <TableCell
                          className={cn(
                            row.upsideDelta == null
                              ? "text-muted-foreground"
                              : row.upsideDelta >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {row.upsideDelta == null || row.upsidePct == null
                            ? "—"
                            : `${formatValue(row.upsideDelta, metric.unit)} (${formatPercentage(row.upsidePct)})`}
                        </TableCell>

                        <TableCell>
                          {row.downside == null ? "—" : formatValue(row.downside, metric.unit)}
                        </TableCell>

                        <TableCell
                          className={cn(
                            row.downsideDelta == null
                              ? "text-muted-foreground"
                              : row.downsideDelta >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {row.downsideDelta == null || row.downsidePct == null
                            ? "—"
                            : `${formatValue(row.downsideDelta, metric.unit)} (${formatPercentage(row.downsidePct)})`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                    </CardContent>
                  </Card>
          </TabsContent>

          {/* Regional */}
          <TabsContent value="regional" className="space-y-8">
            <RegionalContextTab
              metric={metric}
              region={region}
              year={year}
              scenario={scenario}
              selectedRegionMetadata={selectedRegionMetadata}
            />
          </TabsContent>

          {/* Analysis - AI-powered interpretive analysis */}
          <TabsContent value="analysis" className="space-y-6">
            {/* PlaceInsights - PRIMARY: Place-level truth (3 canonical questions) */}
            <PlaceInsights
              regionCode={region}
              regionName={selectedRegion?.name ?? region}
              year={year}
              scenario={scenario}
            />

            {/* Two-column layout: Notable Flags | Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Notable Flags - Place-specific exceptional observations */}
              <NotableFlags
                regionCode={region}
                regionName={selectedRegion?.name ?? region}
                year={year}
                allMetricsData={allMetricsData}
                isLoading={detailData.isLoading || allMetricsData.length === 0}
              />

              {/* Metric Interaction Insights - Cross-metric computed patterns */}
              <MetricInteractionInsights
                allMetricsData={allMetricsData}
                year={year}
                regionName={selectedRegion?.name ?? region}
                currentMetricId={metric.id}
                isLoading={detailData.isLoading || allMetricsData.length === 0}
              />
            </div>

            {/* Related Metrics - quick navigation */}
            <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Related Metrics</CardTitle>
                <CardDescription>Explore connected indicators for deeper analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {METRICS.filter((m) => m.id !== metric.id && m.showInDashboard !== false).map((rm) => {
                    const RelatedIcon = rm.icon
                    return (
                      <Link
                        key={rm.id}
                        href={`/metric/${rm.id}?region=${region}&year=${year}${
                          scenario !== "baseline" ? `&scenario=${scenario}` : ""
                        }`}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 hover:bg-accent transition-colors"
                      >
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <RelatedIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{rm.shortTitle}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ✅ Data (NEW) */}
          <TabsContent value="data" className="space-y-8">
            <MetricDataTab
              metricId={dbMetricId}
              region={region}
              year={year}
              scenario={scenario}
              title={metric.title}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
