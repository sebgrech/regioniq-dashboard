"use client"

import React, { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, GitCompareArrows } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardControls } from "@/components/dashboard-controls"
import { MetricCard } from "@/components/metric-card"
import { FullWidthMap } from "@/components/full-width-map"
import { NarrativeAnalysis } from "@/components/narrative-analysis"
import { DataTable } from "@/components/data-table"
import { SentimentStrip } from "@/components/sentiment-strip"
import { TopMovers } from "@/components/top-movers"
import { MetricCorrelationExplorer } from "@/components/metric-correlation-explorer"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import {
  fetchSeries,
  testSupabaseConnection,
  formatValue,
  formatPercentage,
  calculateChange,
  type DataPoint,
} from "@/lib/data-service"
import {
  updateSearchParams,
  getSearchParam,
  getSearchParamNumber,
} from "@/lib/utils"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { RegionCategoryBadge } from "@/components/region-category-badge"
import { getRegionCategory } from "@/lib/region-category"
import { SectionNavigation } from "@/components/section-navigation"
import { getElectionSummary, getAvailableYears } from "@/lib/elections"

interface DashboardData {
  allMetricsData: {
    metricId: string
    data: DataPoint[]
  }[]
  isLoading: boolean
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  // ----- Persisted readiness for skipping the Supabase test gate -----
  const READY_KEY = "riq:sb-ready"
  const REGION_KEY = "riq:last-region"
  const [showSupabaseTest, setShowSupabaseTest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const forceSetup = (searchParams?.get("setup") ?? "0") === "1"
    if (forceSetup) return true
    return localStorage.getItem(READY_KEY) !== "1"
  })
  // -------------------------------------------------------------------

  // Get region: URL param > default to UKI (avoid localStorage during SSR to prevent hydration mismatch)
  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  const [mapMetric, setMapMetric] = useState("nominal_gva_mn_gbp")
  const [regionIndex, setRegionIndex] = useState<Record<string, Omit<import("@/components/region-search").RegionMetadata, "code">> | null>(null)
  const [selectedRegionMetadata, setSelectedRegionMetadata] = useState<import("@/components/region-search").RegionMetadata | null>(null)

  // Load region index on mount
  useEffect(() => {
    fetch('/processed/region-index.json')
      .then(res => res.json())
      .then(data => setRegionIndex(data))
      .catch(err => {
        console.error('Failed to load region index:', err)
      })
  }, [])
  
  // Load/sync region metadata from URL (keep in lockstep with `region`)
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

  // Supabase test state
  const [connectionStatus, setConnectionStatus] = useState<string>("Not tested")
  const [testData, setTestData] = useState<any[]>([])
  const [supabaseLoading, setSupabaseLoading] = useState(false)

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    allMetricsData: [],
    isLoading: true,
  })


  // Supabase test functions
  const testConnection = async () => {
    setSupabaseLoading(true)
    setConnectionStatus("Testing...")
    try {
      const success = await testSupabaseConnection()
      setConnectionStatus(success ? "✅ Connected!" : "❌ Failed")
    } catch (error) {
      setConnectionStatus(`❌ Error: ${error}`)
    }
    setSupabaseLoading(false)
  }

  const testDataFetch = async () => {
    setSupabaseLoading(true)
    try {
      const data = await fetchSeries({
        metricId: "nominal_gva_mn_gbp",
        region: region,
        scenario: scenario,
      })
      setTestData(data)
      console.log("📊 Fetched test data:", data)

      if (data.length > 0) {
        toast({
          title: "✅ Supabase Data Retrieved!",
          description: `Found ${data.length} data points. Ready to load dashboard!`,
        })
      } else {
        toast({
          title: "⚠️ No Data Found",
          description: "Check console for available metrics/regions.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Test fetch failed:", error)
      setTestData([])
      toast({
        title: "❌ Data Fetch Failed",
        description: "Check console for error details.",
        variant: "destructive",
      })
    }
    setSupabaseLoading(false)
  }

  // Auto-test connection only when the test gate is showing
  useEffect(() => {
    if (showSupabaseTest) testConnection()
  }, [showSupabaseTest])

  // Fetch dashboard data
  useEffect(() => {
    if (!showSupabaseTest) {
      const loadData = async () => {
        setDashboardData((prev) => ({ ...prev, isLoading: true }))
        try {
          // Fetch main dashboard metrics
          const mainMetricsPromises = METRICS.filter((m) => m.showInDashboard !== false).map(async (m) => ({
            metricId: m.id,
            data: await fetchSeries({ metricId: m.id, region, scenario }),
          }))
          
          // Also fetch related metrics (e.g., employment_rate_pct, unemployment_rate_pct for Employment card)
          const relatedMetricsToFetch = new Set<string>()
          METRICS.filter((m) => m.showInDashboard !== false).forEach((m) => {
            if (m.relatedMetrics) {
              m.relatedMetrics.forEach((rmId) => relatedMetricsToFetch.add(rmId))
            }
          })
          
          const relatedMetricsPromises = Array.from(relatedMetricsToFetch).map(async (metricId) => ({
            metricId,
            data: await fetchSeries({ metricId, region, scenario }),
          }))
          
          const [mainMetricsData, relatedMetricsData] = await Promise.all([
            Promise.all(mainMetricsPromises),
            Promise.all(relatedMetricsPromises),
          ])
          
          const allMetricsData = [...mainMetricsData, ...relatedMetricsData]
          setDashboardData({ allMetricsData, isLoading: false })

          toast({
            title: "✅ Dashboard Loaded",
            description: "All metrics loaded from Supabase!",
          })
        } catch (error) {
          console.error("Failed to load dashboard data:", error)
          toast({
            title: "Error loading data",
            description: "Failed to fetch dashboard data. Please try again.",
            variant: "destructive",
          })
          setDashboardData((prev) => ({ ...prev, isLoading: false }))
        }
      }
      loadData()
    }
  }, [region, scenario, toast, showSupabaseTest])

  // Helpers
  const updateURL = (updates: Record<string, string | number | null>) => {
    const newParams = updateSearchParams(searchParams, updates)
    router.push(`?${newParams}`, { scroll: false })
  }

  // Sync localStorage to URL on client mount (after hydration) - only once
  useEffect(() => {
    if (typeof window === "undefined") return
    const urlRegion = searchParams?.get("region")
    if (!urlRegion) {
      // If no URL param, check localStorage and update URL
      const savedRegion = localStorage.getItem(REGION_KEY)
      if (savedRegion && savedRegion !== region) {
        // Avoid momentarily zooming/fitting to a stale metadata region before the URL sync lands.
        setSelectedRegionMetadata(null)
        updateURL({ region: savedRegion })
      }
    } else {
      // Save URL param to localStorage
      try {
        localStorage.setItem(REGION_KEY, urlRegion)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleRegionChange = (metadata: import("@/components/region-search").RegionMetadata) => {
    setSelectedRegionMetadata(metadata)
    // Save to localStorage for persistence
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(REGION_KEY, metadata.code)
      } catch {}
    }
    updateURL({ region: metadata.code })
  }
  const handleYearChange = (newYear: number) => updateURL({ year: newYear })
  const handleScenarioChange = (newScenario: Scenario) => updateURL({ scenario: newScenario })

  const handleCompareRegions = () => {
    // Pass canonical compare params so the compare page loads populated (no blank state).
    router.push(`/compare?regions=${region}&metric=${mapMetric}&year=${year}&scenario=${scenario}`)
  }

  const handleExport = () => {
    toast({ title: "Export started", description: "Your data export is being prepared..." })
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: "Your data has been exported successfully.",
      })
    }, 2000)
  }

  // When user chooses to load the dashboard, persist readiness and clean ?setup
  const handleLoadDashboard = () => {
    try {
      localStorage.setItem(READY_KEY, "1")
    } catch {}
    setShowSupabaseTest(false)

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      params.delete("setup")
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : ".", { scroll: false })
    }
  }

  // If showing Supabase test
  if (showSupabaseTest) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">🧪 Supabase Connection Test</h1>
              <ThemeToggle />
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Testing Parameters:</h2>
              <p><strong>Region:</strong> {region}</p>
              <p><strong>Year:</strong> {year}</p>
              <p><strong>Scenario:</strong> {scenario}</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <Button onClick={testConnection} disabled={supabaseLoading}>
                  {supabaseLoading ? "Testing..." : "Test Connection"}
                </Button>

                <Button onClick={testDataFetch} disabled={supabaseLoading}>
                  {supabaseLoading ? "Fetching..." : "Test Data Fetch"}
                </Button>

                <Button
                  onClick={handleLoadDashboard}
                  variant="outline"
                  disabled={testData.length === 0}
                >
                  Load Full Dashboard 🚀
                </Button>
              </div>

              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p><strong>Connection Status:</strong> {connectionStatus}</p>
              </div>

              {testData.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h3 className="font-semibold mb-2">✅ Sample Data Retrieved:</h3>
                  <pre className="text-sm overflow-auto bg-white dark:bg-gray-900 p-3 rounded">
                    {JSON.stringify(testData.slice(0, 5), null, 2)}
                  </pre>
                  <p className="mt-2 text-sm text-gray-600">
                    Total records: {testData.length} | Years: {testData[0]?.year} - {testData[testData.length-1]?.year}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <p><strong>Instructions:</strong></p>
              <ol className="list-decimal list-inside space-y-1 mt-2">
                <li>Check "Connection Status" above - should show ✅ Connected!</li>
                <li>Check browser console for available metrics/regions/data_types</li>
                <li>Click "Test Data Fetch" to try fetching data with current parameters</li>
                <li>Once you see sample data, click "Load Full Dashboard" 🎉</li>
              </ol>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm"><strong>Next Steps:</strong></p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li>If no data found, check your CSV has the right metric_id/region_code values</li>
                <li>Your METRICS config needs to match metric_id values in your CSV</li>
                <li>Your scenario parameter needs to match data_type values in your CSV</li>
              </ul>
            </div>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  // Main dashboard (original code)
  const metricCardsData = useMemo(() => {
    if (!dashboardData.allMetricsData || dashboardData.allMetricsData.length === 0) {
      return []
    }
    
    return METRICS.filter((m) => m.showInDashboard !== false).map((metricConfig) => {
    const metricData =
      dashboardData.allMetricsData.find((d) => d.metricId === metricConfig.id)?.data || []
    const currentYearData = metricData.find((d) => d.year === year)
    const previousYearData = metricData.find((d) => d.year === year - 1)

    const currentValue = currentYearData?.value || 0
    const previousValue = previousYearData?.value || 0
    const change = calculateChange(currentValue, previousValue)

    const sparklineData = metricData
      .filter((d) => d.year >= year - 9 && d.year <= year)
      .map((d) => d.value)

    // Get related metrics data if this metric has related metrics (e.g., Employment)
    const relatedMetrics: Array<{ id: string; title: string; sparklineData: number[]; value: string; change: string; changeValue: number }> = []
    if (metricConfig.relatedMetrics && metricConfig.relatedMetrics.length > 0) {
      for (const relatedMetricId of metricConfig.relatedMetrics) {
        const relatedMetricData = dashboardData.allMetricsData.find(
          (d) => d.metricId === relatedMetricId
        )?.data || []
        const relatedMetricConfig = METRICS.find((m) => m.id === relatedMetricId)
        
        if (relatedMetricConfig && relatedMetricData.length > 0) {
          const relatedSparklineData = relatedMetricData
            .filter((d) => d.year >= year - 9 && d.year <= year)
            .map((d) => d.value)
          
          // Calculate current value and YoY change for related metrics
          const relatedCurrentYearData = relatedMetricData.find((d) => d.year === year)
          const relatedPreviousYearData = relatedMetricData.find((d) => d.year === year - 1)
          const relatedCurrentValue = relatedCurrentYearData?.value || 0
          const relatedPreviousValue = relatedPreviousYearData?.value || 0
          const relatedChange = calculateChange(relatedCurrentValue, relatedPreviousValue)
          
          relatedMetrics.push({
            id: relatedMetricId,
            title: relatedMetricConfig.title,
            sparklineData: relatedSparklineData,
            value: formatValue(relatedCurrentValue, relatedMetricConfig.unit, relatedMetricConfig.decimals),
            change: formatPercentage(relatedChange),
            changeValue: relatedChange,
          })
        }
      }
    }

    return {
      ...metricConfig,
      value: formatValue(currentValue, metricConfig.unit, metricConfig.decimals),
      change: formatPercentage(change),
      changeValue: change,
      sparklineData,
      relatedMetrics,
      href: `/metric/${metricConfig.id}?region=${region}&year=${year}${
        scenario !== "baseline" ? `&scenario=${scenario}` : ""
      }`,
      onClick: () =>
        router.push(
          `/metric/${metricConfig.id}?region=${region}&year=${year}${
            scenario !== "baseline" ? `&scenario=${scenario}` : ""
          }`
        ),
    }
    })
  }, [dashboardData.allMetricsData, year, scenario, region])

  // Prepare sentiment strip data
  const sentimentMetrics = useMemo(() => {
    return metricCardsData.map((card) => ({
      title: card.title || card.shortTitle || card.id,
      change: card.changeValue ?? 0,
      changeFormatted: card.change || "+0.0%",
    }))
  }, [metricCardsData])

  const allMetricsForMap = METRICS.filter((m) => m.showInDashboard !== false).map((metricConfig) => {
    const metricData =
      dashboardData.allMetricsData.find((d) => d.metricId === metricConfig.id)?.data || []
    const currentYearData = metricData.find((d) => d.year === year)
    return { metricId: metricConfig.id, value: currentYearData?.value || 0 }
  })

  const currentRegion = REGIONS.find((r) => r.code === region)
  const regionName = currentRegion?.name || region
  const regionCode = currentRegion?.code || region

  // Calculate region category based on metric changes
  const regionCategory = useMemo(() => {
    if (!metricCardsData || metricCardsData.length === 0) return null

    // Extract growth rates from metric cards
    const populationMetric = metricCardsData.find((m) => m.id === "population_total")
    const gvaMetric = metricCardsData.find((m) => m.id === "nominal_gva_mn_gbp")
    const incomeMetric = metricCardsData.find((m) => m.id === "gdhi_per_head_gbp")
    const employmentMetric = metricCardsData.find((m) => m.id === "emp_total_jobs")

    const populationGrowth = populationMetric?.changeValue || 0
    const gvaGrowth = gvaMetric?.changeValue || 0
    const incomeGrowth = incomeMetric?.changeValue || 0
    const employmentGrowth = employmentMetric?.changeValue || 0

    // Calculate GVA per capita if possible
    const currentYearData = dashboardData.allMetricsData.find((d) => d.metricId === "nominal_gva_mn_gbp")
    const populationData = dashboardData.allMetricsData.find((d) => d.metricId === "population_total")
    const currentYear = year
    const gvaValue = currentYearData?.data.find((d) => d.year === currentYear)?.value || 0
    const populationValue = populationData?.data.find((d) => d.year === currentYear)?.value || 0
    const gvaPerCapita = populationValue > 0 ? (gvaValue * 1000000) / populationValue : undefined

    return getRegionCategory({
      populationGrowth,
      gvaGrowth,
      incomeGrowth,
      employmentGrowth,
      gvaPerCapita,
    })
  }, [metricCardsData, dashboardData.allMetricsData, year])

  const breadcrumbItems = [
    { label: "UK", href: "/?level=ITL1" },
    {
      label: currentRegion?.country || "UK",
      href: `/regions?country=${currentRegion?.country || "UK"}`,
    },
    { label: regionName },
  ]

  return (
    <div className="min-h-screen bg-background">
      {!isMapFullscreen && (
        <DashboardControls
          region={region}
          year={year}
          scenario={scenario}
          onRegionChange={handleRegionChange}
          onYearChange={handleYearChange}
          onScenarioChange={handleScenarioChange}
          onExport={handleExport}
        />
      )}

      {/* Section Navigation */}
      <SectionNavigation 
        isMapFullscreen={isMapFullscreen}
        region={region}
        year={year}
        scenario={scenario}
      />

      {/* Header */}
      <div className="container mx-auto px-4 py-8 space-y-4 border-b border-border/40">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Main Dashboard
            </h1>
            <p className="text-xl text-muted-foreground">
              Regional Overview • {regionName} ({regionCode}) • {year}{" "}
              {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
            </p>
            <Breadcrumbs items={breadcrumbItems} />
          </div>
          <div className="flex items-center gap-3">
            {regionCategory && <RegionCategoryBadge category={regionCategory} />}
            {currentRegion?.level === "LAD" && (() => {
              const availableYears = getAvailableYears(currentRegion.code)
              const mostRecentYear = availableYears.length > 0 ? Math.max(...availableYears) : null
              const electionSummary = mostRecentYear ? getElectionSummary(currentRegion.code, mostRecentYear) : null
              if (!electionSummary) return null
              
              const totalSeats = Object.values(electionSummary.seats).reduce((sum, s) => sum + s, 0)
              const dominantSeats = electionSummary.seats[electionSummary.dominant_party] || 0
              const hasMajority = totalSeats > 0 && dominantSeats / totalSeats > 0.5
              const controlLabel = hasMajority 
                ? `${electionSummary.dominant_party} locally controlled`
                : "No overall control"
              
              // Party colors
              const partyColors: Record<string, string> = {
                Labour: "#d50000",
                Conservative: "#0047ab",
                "Liberal Democrats": "#ffcc00",
                Green: "#009e3b",
                "Reform UK": "#00bcd4",
                Independent: "#888888",
                Other: "#aaaaaa",
              }
              const color = hasMajority 
                ? (partyColors[electionSummary.dominant_party] || "#888888")
                : "#888888"
              
              return (
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border"
                  style={{
                    borderColor: color,
                    color: color,
                    backgroundColor: color + "15",
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {controlLabel}
                </div>
              )
            })()}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Sentiment Strip */}
      {sentimentMetrics && sentimentMetrics.length > 0 && (
        <SentimentStrip
          regionName={regionName}
          year={year}
          metrics={sentimentMetrics}
          isLoading={dashboardData.isLoading}
        />
      )}

      {/* Cards - Light blue tint for economic data */}
      <div className="container mx-auto px-4 space-y-8">
        <div id="overview" className="scroll-mt-32 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-6 -mx-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metricCardsData.map((cardData) => (
            <div
              key={cardData.id}
              className="group cursor-pointer transition-all duration-200 hover:scale-[1.02] relative z-10"
              onClick={cardData.onClick}
            >
              <MetricCard
                {...cardData}
                isLoading={dashboardData.isLoading}
                className="group-hover:border-gray-500 group-hover:shadow-lg transition-all duration-200"
              />
              {cardData.id !== "emp_total_jobs" && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-muted-foreground text-center mt-1">
                  Click for details
                </div>
              )}
            </div>
          ))}
          </div>
        </div>

        <div id="compare" className="scroll-mt-32 px-4">
          <div className="rounded-xl border border-border/60 bg-accent/10 dark:bg-accent/15 px-6 py-5">
            {/* Mobile: stack. Desktop: text left, CTA right (standard SaaS CTA layout). */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold text-foreground">
                  Compare regions side-by-side
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Start with <span className="font-medium text-foreground/85">{regionName}</span> and add up to 5 regions.
                </div>
              </div>

              <div className="flex sm:justify-end">
                <Button onClick={handleCompareRegions} size="lg" className="w-full sm:w-auto">
                  <GitCompareArrows className="h-4 w-4 mr-2" />
            Compare Regions
          </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Map - Neutral background (geographic) */}
        <div id="map" className="scroll-mt-32 w-full">
          <FullWidthMap
            selectedRegion={region}
            selectedRegionMetadata={selectedRegionMetadata}
            mapMetric={mapMetric}
            year={year}
            scenario={scenario}
            allMetricsData={allMetricsForMap}
            allMetricsSeriesData={dashboardData.allMetricsData}
            onRegionSelect={handleRegionChange}
            onMapMetricChange={setMapMetric}
            onYearChange={handleYearChange}
            onScenarioChange={handleScenarioChange}
            onExport={handleExport}
            onFullscreenChange={setIsMapFullscreen}
          />
        </div>

        {/* Top Movers - Comparative context */}
        <div id="movers" className="scroll-mt-32 w-full">
          <TopMovers
            year={year}
            scenario={scenario}
            isLoading={dashboardData.isLoading}
          />
        </div>

        {/* Analysis - Warm beige background (narrative) */}
        <div id="analysis" className="scroll-mt-32 w-full bg-amber-50/50 dark:bg-amber-950/20 rounded-xl -mx-4">
          <div className="p-6 space-y-6">
            <NarrativeAnalysis
              region={region}
              year={year}
              scenario={scenario}
              allMetricsData={allMetricsForMap}
              allMetricsSeriesData={dashboardData.allMetricsData}
              isLoading={dashboardData.isLoading}
            />

            <MetricCorrelationExplorer
              regionName={regionName}
              year={year}
              scenario={scenario}
              allMetricsSeriesData={dashboardData.allMetricsData}
            />
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading RegionIQ Dashboard...</span>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}

