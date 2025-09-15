"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DashboardControls } from "@/components/dashboard-controls"
import { MetricCard } from "@/components/metric-card"
import { FullWidthMap } from "@/components/full-width-map"
import { NarrativeAnalysis } from "@/components/narrative-analysis"
import { DataTable } from "@/components/data-table"
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

  // Defaults
  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  const [mapMetric, setMapMetric] = useState("gva")

  // Supabase test state
  const [showSupabaseTest, setShowSupabaseTest] = useState(true)
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
      // Test with current dashboard parameters
      const data = await fetchSeries({
        metricId: "nominal_gva_mn_gbp", // Correct metric ID from Supabase
        region: region,
        scenario: scenario
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

  // Auto-test connection on load
  useEffect(() => {
    testConnection()
  }, [])

  // Fetch dashboard data
  useEffect(() => {
    if (!showSupabaseTest) {
      const loadData = async () => {
        setDashboardData((prev) => ({ ...prev, isLoading: true }))
        try {
          const allMetricsPromises = METRICS.map(async (m) => ({
            metricId: m.id,
            data: await fetchSeries({ metricId: m.id, region, scenario }),
          }))
          const allMetricsData = await Promise.all(allMetricsPromises)
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

  const handleRegionChange = (newRegion: string) => updateURL({ region: newRegion })
  const handleYearChange = (newYear: number) => updateURL({ year: newYear })
  const handleScenarioChange = (newScenario: Scenario) => updateURL({ scenario: newScenario })

  const handleCompareRegions = () => {
    router.push(`/compare?region=${region}&year=${year}&scenario=${scenario}`)
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
                  onClick={() => setShowSupabaseTest(false)}
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
  const metricCardsData = METRICS.map((metricConfig) => {
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

    return {
      ...metricConfig,
      value: formatValue(currentValue, metricConfig.unit, metricConfig.decimals),
      change: formatPercentage(change),
      changeValue: change,
      sparklineData,
      href: `/metric/${metricConfig.id}?region=${region}&year=${year}&scenario=${scenario}`,
      onClick: () =>
        router.push(`/metric/${metricConfig.id}?region=${region}&year=${year}&scenario=${scenario}`),
    }
  })

  const allMetricsForMap = METRICS.map((metricConfig) => {
    const metricData =
      dashboardData.allMetricsData.find((d) => d.metricId === metricConfig.id)?.data || []
    const currentYearData = metricData.find((d) => d.year === year)
    return { metricId: metricConfig.id, value: currentYearData?.value || 0 }
  })

  const currentRegion = REGIONS.find((r) => r.code === region)
  const regionName = currentRegion?.name || region
  const regionCode = currentRegion?.code || region

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
      <DashboardControls
        region={region}
        year={year}
        scenario={scenario}
        onRegionChange={handleRegionChange}
        onYearChange={handleYearChange}
        onScenarioChange={handleScenarioChange}
        onExport={handleExport}
      />

      {/* Header with back to test button */}
      <div className="container mx-auto px-4 py-8 space-y-4 border-b border-border/40">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-[#00FFF7] via-[#C400FF] to-[#FF3C78] bg-clip-text text-transparent">
                Main
              </span>{" "}
              Dashboard 🚀
            </h1>
            <p className="text-xl text-muted-foreground">
              Regional Overview • {regionName} ({regionCode}) • {year}{" "}
              {scenario.charAt(0).toUpperCase() + scenario.slice(1)} •{" "}
              <span className="text-green-600">Live Supabase Data</span>
            </p>
            <Breadcrumbs items={breadcrumbItems} />
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSupabaseTest(true)}
            >
              🧪 Test Mode
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="container mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {metricCardsData.map((cardData) => (
            <div
              key={cardData.id}
              className="group cursor-pointer transition-all duration-200 hover:scale-[1.02]"
              onClick={cardData.onClick}
            >
              <MetricCard
                {...cardData}
                isLoading={dashboardData.isLoading}
                className="group-hover:border-gray-500 group-hover:shadow-lg transition-all duration-200"
              />
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-muted-foreground text-center mt-1">
                Click for details
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center px-4">
          <Button
            onClick={handleCompareRegions}
            variant="outline"
            size="lg"
            className="bg-transparent w-full sm:w-auto"
          >
            Compare Regions
          </Button>
        </div>

        <div className="w-full">
          <FullWidthMap
            selectedRegion={region}
            mapMetric={mapMetric}
            year={year}
            scenario={scenario}
            allMetricsData={allMetricsForMap}
            onRegionSelect={handleRegionChange}
            onMapMetricChange={setMapMetric}
          />
        </div>

        <div className="w-full">
          <NarrativeAnalysis
            region={region}
            year={year}
            scenario={scenario}
            allMetricsData={allMetricsForMap}
            isLoading={dashboardData.isLoading}
          />
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