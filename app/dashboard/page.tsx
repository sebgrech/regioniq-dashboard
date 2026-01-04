
"use client"

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, GitCompareArrows, Sparkles, Database, ArrowRight, Target, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardControls } from "@/components/dashboard-controls"
import { MetricCard } from "@/components/metric-card"
import { FullWidthMap } from "@/components/full-width-map"
import { NarrativeAnalysis } from "@/components/narrative-analysis"
import { DataTable } from "@/components/data-table"
import { ComingSoonGrid } from "@/components/coming-soon-grid"
import { RoadmapFeedback } from "@/components/roadmap-feedback"
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
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { RegionCategoryBadge } from "@/components/region-category-badge"
import { getRegionCategory } from "@/lib/region-category"
import { SectionNavigation } from "@/components/section-navigation"
import { getElectionSummary, getAvailableYears } from "@/lib/elections"
import { OnboardingTour } from "@/components/onboarding-tour"
import { FilmGrainOverlay } from "@/components/film-grain-overlay"
import { useMicroConfetti, resetCelebrations } from "@/components/micro-confetti"

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
  const [user, setUser] = useState<any | undefined>(undefined)  // undefined = loading, null = no user
  const [tourOpen, setTourOpen] = useState(false)
  
  // Micro-confetti for #1 celebrations
  const { celebrate } = useMicroConfetti()
  
  // Track scroll for parallax effect
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // ----- Dev-only Supabase test gate (opt-in via ?setup=1) -----
  const READY_KEY = "riq:sb-ready"
  const REGION_KEY = "riq:last-region"
  const [showSupabaseTest, setShowSupabaseTest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    // Only show test UI when explicitly requested via ?setup=1
    const forceSetup = (searchParams?.get("setup") ?? "0") === "1"
    return forceSetup
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

  // Load current user (for welcome + per-user tour persistence)
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me", { cache: "no-store" as RequestCache })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setUser(data?.user ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = useMemo(() => {
    const u = user as any
    const meta = u?.user_metadata ?? {}
    return (
      meta?.full_name ||
      meta?.name ||
      meta?.display_name ||
      meta?.preferred_username ||
      (typeof u?.email === "string" ? u.email.split("@")[0] : null) ||
      null
    )
  }, [user])

  const clearQS = (keys: string[]) => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    let changed = false
    keys.forEach((k) => {
      if (params.has(k)) {
        params.delete(k)
        changed = true
      }
    })
    // Only navigate if we actually removed something
    if (!changed) return
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  const markTourSeen = () => {
    if (typeof window === "undefined") return
    const uid = (user as any)?.id
    if (!uid) return
    try {
      localStorage.setItem(`riq:tour:v1:${uid}`, "1")
    } catch {}
    clearQS(["tour"])
  }

  // Auto-open tour right after login (once per user per browser), after the Supabase gate is passed.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (showSupabaseTest) return
    const uid = (user as any)?.id
    if (!uid) return

    const forceTour = (searchParams?.get("tour") ?? "0") === "1"

    let seen = false
    try {
      seen = localStorage.getItem(`riq:tour:v1:${uid}`) === "1"
    } catch {}

    let justLoggedIn = false
    try {
      justLoggedIn = localStorage.getItem("riq:just-logged-in") === "1"
    } catch {}

    if ((justLoggedIn || forceTour) && !seen) {
      setTourOpen(true)
    }

    // Consume the flag so normal navigation/refresh doesn't re-trigger.
    if (justLoggedIn) {
      try {
        localStorage.removeItem("riq:just-logged-in")
      } catch {}
    }
    if (forceTour) clearQS(["tour"])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSupabaseTest, (user as any)?.id, searchParams])
  
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

  // Fetch dashboard data (wait for auth to settle first)
  useEffect(() => {
    // Don't fetch if showing Supabase test UI
    if (showSupabaseTest) return
    // Wait for auth to settle (user === undefined means still loading)
    if (user === undefined) return

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
  }, [region, scenario, toast, showSupabaseTest, user])

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
    // Reset confetti celebrations when region changes
    resetCelebrations()
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


  const allMetricsForMap = METRICS.filter((m) => m.showInDashboard !== false).map((metricConfig) => {
    const metricData =
      dashboardData.allMetricsData.find((d) => d.metricId === metricConfig.id)?.data || []
    const currentYearData = metricData.find((d) => d.year === year)
    return { metricId: metricConfig.id, value: currentYearData?.value || 0 }
  })

  const currentRegion = REGIONS.find((r) => r.code === region)
  const regionName = currentRegion?.name || region
  const regionCode = currentRegion?.code || region
  const isUK = currentRegion?.level === "UK"

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


  return (
    <div className="min-h-screen bg-background">
      {/* Film Grain Overlay - "Time Machine" effect for historical data */}
      <FilmGrainOverlay year={year} forecastStartYear={2024} />
      
      {!isMapFullscreen && (
        <DashboardControls
          region={region}
          year={year}
          onRegionChange={handleRegionChange}
          onYearChange={handleYearChange}
          userEmail={(user as any)?.email}
        />
      )}

      {/* Section Navigation */}
      <SectionNavigation isMapFullscreen={isMapFullscreen} />

      {/* Header - Region as hero with subtle parallax */}
      <div 
        className="container mx-auto px-4 py-6 border-b border-border/40"
        style={{
          transform: `translateY(${scrollY * 0.03}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {displayName ? (
              <p className="text-xs text-muted-foreground">
                Welcome <span className="font-medium text-foreground">{displayName}</span>
              </p>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight">{regionName}</h1>
            <p className="text-sm text-muted-foreground">
              {regionCode} • {year} • {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sentiment Badge - single summary of all metrics */}
            {!dashboardData.isLoading && metricCardsData.length > 0 && (() => {
              const positiveCount = metricCardsData.filter(m => m.changeValue > 0).length
              const negativeCount = metricCardsData.filter(m => m.changeValue < 0).length
              const totalCount = metricCardsData.length
              // Use past tense for historical data (before 2024), present for forecasts
              const isHistorical = year < 2024
              const growVerb = isHistorical ? "grew" : "growing"
              const declineVerb = isHistorical ? "declined" : "declining"
              
              if (positiveCount === totalCount) {
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <TrendingUp className="h-3 w-3" />
                    All metrics {growVerb}
                  </div>
                )
              } else if (negativeCount === totalCount) {
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <TrendingDown className="h-3 w-3" />
                    All metrics {declineVerb}
                  </div>
                )
              } else if (positiveCount > negativeCount) {
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <TrendingUp className="h-3 w-3" />
                    {positiveCount}/{totalCount} {growVerb}
                  </div>
                )
              } else if (negativeCount > positiveCount) {
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <TrendingDown className="h-3 w-3" />
                    {negativeCount}/{totalCount} {declineVerb}
                  </div>
                )
              } else {
                return (
                  <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold bg-muted text-muted-foreground border border-border">
                    Mixed signals
                  </div>
                )
              }
            })()}
            {regionCategory && <RegionCategoryBadge category={regionCategory} />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTourOpen(true)}
              className="hidden sm:inline-flex"
            >
              Take a tour
            </Button>
            {/* Local Control Badge - HIDDEN FOR V1
                Local election data is complex (thirds elections, mayoral vs council, etc.)
                Westminster context is kept as it's clearer and more accurate.
                To re-enable, uncomment the block below:
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
            */}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main content sections */}
      <div className="container mx-auto px-4 space-y-4">
        {/* KPI Cards */}
        <div id="overview" className="scroll-mt-32 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metricCardsData.map((cardData, idx) => (
            <div
              key={cardData.id}
              id={idx === 0 ? "tour-kpi-card" : undefined}
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

        {/* Action Cards - What do you want to do next? */}
        <div id="actions" className="scroll-mt-32 w-full">
          <div
            className={`grid gap-4 ${
              isUK ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {/* Compare Regions */}
            <div 
              className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
            >
              <button
                id="tour-compare-action"
                onClick={handleCompareRegions}
                className="w-full cursor-pointer group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/10 hover:border-primary/40 p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                  <GitCompareArrows className="h-5 w-5 text-primary transition-transform duration-500 group-hover:rotate-180" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    Compare Regions
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Compare {regionName} with up to 5 regions
                  </div>
                </div>
              </button>
            </div>

            {/* Full Analysis - Hidden for UK */}
            {!isUK && (
              <div 
                className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
              >
                <Link
                  id="tour-full-analysis-action"
                  href={`/analysis?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}
                  className="h-full group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/10 hover:border-primary/40 p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <Sparkles className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-125" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      Full Analysis
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Deep-dive into {regionName}
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Westminster Deep Dive - UK only */}
            {isUK && (
              <div 
                className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: "75ms", animationFillMode: "backwards" }}
              >
                <Link
                  id="tour-westminster-action"
                  href={`/westminster?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}
                  className="h-full group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/10 hover:border-primary/40 p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <Sparkles className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-125" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      Westminster
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="text-sm text-muted-foreground">Deep-dive into Westminster</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Catchment Analysis */}
            <div 
              className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
            >
              <Link
                id="tour-catchment-action"
                href={`/catchment?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}
                className="h-full group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/10 hover:border-primary/40 p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110 relative overflow-hidden">
                  <Target className="h-5 w-5 text-primary transition-all duration-500 group-hover:rotate-90" />
                  {/* Pulse rings on hover */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3 h-3 rounded-full border-2 border-primary/40 opacity-0 group-hover:opacity-100 group-hover:scale-[2.5] transition-all duration-700" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3 h-3 rounded-full border border-primary/20 opacity-0 group-hover:opacity-100 group-hover:scale-[3.5] transition-all duration-1000 delay-100" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    Catchment Analysis
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Draw areas or generate isochrones
                  </div>
                </div>
              </Link>
            </div>

            {/* Data Explorer */}
            <div 
              className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "225ms", animationFillMode: "backwards" }}
            >
              <Link
                id="tour-data-action"
                href={`/data?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}
                className="h-full group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card hover:bg-accent/10 hover:border-primary/40 p-5 text-left transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                  <Database className="h-5 w-5 text-primary transition-all duration-700 ease-out group-hover:rotate-[360deg]" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    Data Explorer
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Query & export raw data
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div id="analysis" className="scroll-mt-32 w-full mt-6">
          <div id="tour-ai-analysis" className="w-full">
            <NarrativeAnalysis
              region={region}
              year={year}
              scenario={scenario}
              allMetricsData={allMetricsForMap}
              allMetricsSeriesData={dashboardData.allMetricsData}
              isLoading={dashboardData.isLoading}
            />
          </div>
        </div>

        {/* Roadmap Section - Coming Soon features */}
        <div id="roadmap" className="scroll-mt-32 w-full mt-8 pt-6 border-t border-border/30">
          <ComingSoonGrid regionName={regionName} />
        </div>

        {/* Contribute Section - Feedback form */}
        <div id="contribute" className="scroll-mt-32 w-full mt-6 pb-12">
          <div id="tour-feedback">
            <RoadmapFeedback currentRegion={region} />
          </div>
        </div>
      </div>

      <Toaster />

      <OnboardingTour
        open={tourOpen}
        onOpenChange={setTourOpen}
        isUK={isUK}
        onFinish={markTourSeen}
        userName={displayName}
      />
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

