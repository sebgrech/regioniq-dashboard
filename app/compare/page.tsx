"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RegionPicker } from "@/components/region-picker"
import { DataTable } from "@/components/data-table"
import { ExportMenu } from "@/components/export-menu"
import { ErrorBoundaryWrapper } from "@/components/error-boundary"

import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { getSearchParam, updateSearchParams } from "@/lib/utils"
import { withDataToast } from "@/lib/with-toast"

// Inline ChartTimeseriesCompare component - keeping it in the page to avoid import issues
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts"
import { formatValue } from "@/lib/data-service"
import { YEARS } from "@/lib/metrics.config"

const ChartTimeseriesCompare = ({ title, description, regions, unit, metricId, isLoading, className }: any) => {
  const chartData = useMemo(() => {
    if (!regions || regions.length === 0) return []
    
    // Create a map of years to values for each region
    const yearMap = new Map<number, any>()
    
    // Get all unique years across all regions
    const allYears = new Set<number>()
    regions.forEach(({ data }: any) => {
      data?.forEach((point: any) => allYears.add(point.year))
    })
    
    // Initialize each year
    Array.from(allYears).forEach((year) => {
      yearMap.set(year, { year })
    })
    
    // Add data for each region
    regions.forEach(({ regionName, data }: any, index: number) => {
      // Use index-based keys to avoid issues with special characters in region names
      const dataKey = `region${index}`
      data?.forEach((point: any) => {
        const existing = yearMap.get(point.year)
        if (existing) {
          if (!('type' in existing)) {
            existing.type = point.type
          }
          existing[dataKey] = point.value
        }
      })
    })
    
    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [regions])

  // Find where forecast starts - the first year that has type "forecast"
  const forecastStartYear = useMemo(() => {
    if (!chartData || chartData.length === 0) return null
    
    const firstForecastPoint = chartData.find(point => point.type === "forecast")
    return firstForecastPoint ? firstForecastPoint.year : null
  }, [chartData])

  // Custom tooltip to show actual region names
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const dataPoint = payload[0]?.payload
    const isHistorical = dataPoint?.type === "historical"

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
          <Badge variant={isHistorical ? "secondary" : "outline"} className="text-xs">
            {isHistorical ? "Historical" : "Forecast"}
          </Badge>
        </div>
        <div className="space-y-1">
          {payload
            .filter((entry: any) => entry.value != null)
            .map((entry: any, index: number) => {
              // Extract region index from dataKey (e.g., "region0" -> 0)
              const regionIndex = parseInt(entry.dataKey.replace('region', ''))
              const regionName = regions[regionIndex]?.regionName || entry.dataKey
              
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{regionName}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatValue(entry.value, unit)}
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Color palette for lines
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline" className="text-xs">
            {Math.min(...chartData.map(d => d.year))}-{Math.max(...chartData.map(d => d.year))}
          </Badge>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#e5e7eb" 
                opacity={0.5}
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(value) => formatValue(value, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Vertical line at forecast start */}
              {forecastStartYear && (
                <ReferenceLine
                  x={forecastStartYear}
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  strokeOpacity={0.8}
                  label={{ value: "Forecast", position: "top", fill: "#6b7280", fontSize: 12 }}
                />
              )}
              
              {/* Render a line for each region */}
              {regions.map((region: any, index: number) => (
                <Line
                  key={`region${index}`}
                  type="monotone"
                  dataKey={`region${index}`}
                  name={region.regionName}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, stroke: colors[index % colors.length], strokeWidth: 2, fill: "#fff" }}
                  connectNulls={false}
                />
              ))}
              
              <Legend 
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value, entry: any) => {
                  // Extract region index from dataKey
                  const regionIndex = parseInt(value.replace('region', ''))
                  return regions[regionIndex]?.regionName || value
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Footer info */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-600" />
              <span>Historical (solid)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-600 opacity-50" style={{ borderTop: "2px dashed" }} />
              <span>Forecast (dashed)</span>
            </div>
          </div>
          <div className="text-xs">
            Forecast data shown with dashed lines
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ComparisonData {
  [regionCode: string]: {
    [metricId: string]: DataPoint[]
  }
}

interface RegionChip {
  code: string
  name: string
  pinned?: boolean
}

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // -------- URL state --------
  const regionsParam = getSearchParam(searchParams, "regions", "UKI")
  const metric = getSearchParam(searchParams, "metric", "population")
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario

  const selectedRegions = useMemo(
    () => regionsParam.split(",").filter(Boolean),
    [regionsParam],
  )

  const pinnedRegion = "UKI" // always show London

  // All regions to display (pinned first, then unique selection)
  const allDisplayRegions = useMemo(
    () => Array.from(new Set([pinnedRegion, ...selectedRegions])),
    [selectedRegions],
  )

  // -------- Data state --------
  const [comparisonData, setComparisonData] = useState<ComparisonData>({})
  const [isLoading, setIsLoading] = useState(false)

  // Do we already have data for all regions for the current metric+scenario?
  const hasAllData = useMemo(
    () => allDisplayRegions.every((r) => Boolean(comparisonData[r]?.[metric]?.length)),
    [allDisplayRegions, comparisonData, metric],
  )

  // -------- Fetch (only when needed) --------
  useEffect(() => {
    const regionsToFetch = allDisplayRegions.filter((r) => !comparisonData[r]?.[metric])

    if (regionsToFetch.length === 0) {
      return
    }

    let isCancelled = false
    
    const fetchData = async () => {
      setIsLoading(true)
      
      try {
        const results = await Promise.all(
          regionsToFetch.map(async (regionCode) => {
            const series = await fetchSeries({ metricId: metric, region: regionCode, scenario })
            return { regionCode, series }
          })
        )

        if (isCancelled) return

        setComparisonData((prev) => {
          const next: ComparisonData = { ...prev }
          for (const { regionCode, series } of results) {
            next[regionCode] = {
              ...(next[regionCode] ?? {}),
              [metric]: series,
            }
          }
          return next
        })
      } catch (e) {
        console.error("Failed to load comparison data:", e)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }
    
    fetchData()

    return () => {
      isCancelled = true
    }
  }, [allDisplayRegions, metric, scenario])

  // -------- URL helpers --------
  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const newParams = updateSearchParams(searchParams, updates)
      router.push(`/compare?${newParams}`, { scroll: false })
    },
    [router, searchParams],
  )

  const handleRegionsChange = useCallback(
    (regions: string | string[]) => {
      const regionsArray = Array.isArray(regions) ? regions : [regions]
      // do not include pinned in the URL
      const filtered = regionsArray.filter((r) => r !== pinnedRegion)
      updateURL({ regions: filtered.join(",") })
    },
    [updateURL],
  )

  const handleMetricChange = useCallback(
    (newMetric: string) => updateURL({ metric: newMetric }),
    [updateURL],
  )

  const addRegion = useCallback(
    (regionCode: string) => {
      if (!selectedRegions.includes(regionCode) && regionCode !== pinnedRegion && selectedRegions.length < 5) {
        handleRegionsChange([...selectedRegions, regionCode])
      }
    },
    [handleRegionsChange, selectedRegions],
  )

  const removeRegion = useCallback(
    (regionToRemove: string) => {
      if (regionToRemove !== pinnedRegion) {
        const newRegions = selectedRegions.filter((r) => r !== regionToRemove)
        handleRegionsChange(newRegions)
      }
    },
    [handleRegionsChange, selectedRegions],
  )

  // -------- UI prep (memoized to avoid chart re-mounts) --------
  const selectedMetric = useMemo(() => METRICS.find((m) => m.id === metric), [metric])

  const regionChips: RegionChip[] = useMemo(
    () => [
      {
        code: pinnedRegion,
        name: REGIONS.find((r) => r.code === pinnedRegion)?.name || pinnedRegion,
        pinned: true,
      },
      ...selectedRegions
        .filter((code) => code !== pinnedRegion)
        .map((code) => ({
          code,
          name: REGIONS.find((r) => r.code === code)?.name || code,
        })),
    ],
    [selectedRegions],
  )

  // Prepare data for the new ChartTimeseriesCompare component
  const chartRegions = useMemo(
    () =>
      allDisplayRegions.map((regionCode, index) => {
        const region = REGIONS.find((r) => r.code === regionCode)
        const data = comparisonData[regionCode]?.[metric] || []
        return {
          regionName: region?.name || regionCode,
          data,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        }
      }),
    [allDisplayRegions, comparisonData, metric],
  )

  const exportData = useMemo(
    () =>
      allDisplayRegions.map((regionCode) => {
        const region = REGIONS.find((r) => r.code === regionCode)
        const metricData = comparisonData[regionCode]?.[metric] || []
        const latest = metricData[metricData.length - 1]
        return {
          region: region?.name || regionCode,
          code: regionCode,
          metric: selectedMetric?.title || metric,
          value: latest?.value ?? 0,
          scenario,
          year: latest?.year ?? "",
        }
      }),
    [allDisplayRegions, comparisonData, metric, scenario, selectedMetric?.title],
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Regional Comparison</h1>
                <p className="text-sm text-muted-foreground">
                  Compare economic metrics across multiple UK regions
                </p>
              </div>
            </div>
            <ExportMenu data={exportData} filename="region-comparison" disabled={!hasAllData && isLoading} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Controls */}
        <ErrorBoundaryWrapper name="comparison controls">
          <Card>
            <CardHeader>
              <CardTitle>Comparison Settings</CardTitle>
              <CardDescription>
                Select regions and metrics to compare (max 5 regions + London reference)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Region Selection with Chips */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Regions to Compare</label>
                <div className="flex flex-wrap gap-2">
                  {regionChips.map((chip) => (
                    <Badge
                      key={`chip-${chip.code}`}
                      variant={chip.pinned ? "default" : "secondary"}
                      className="gap-2 px-3 py-1"
                    >
                      <span>{chip.name}</span>
                      {chip.pinned ? (
                        <span className="text-xs opacity-75">(pinned)</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => removeRegion(chip.code)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </Badge>
                  ))}

                  {selectedRegions.length < 5 && (
                    <RegionPicker
                      value=""
                      onValueChange={(value) => addRegion(value as string)}
                      placeholder="Add region..."
                    />
                  )}
                </div>

                {selectedRegions.length === 5 && (
                  <p className="text-xs text-muted-foreground">
                    Maximum regions reached (5 + London reference)
                  </p>
                )}
              </div>

              {/* Metric Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Metric</label>
                <div className="flex flex-wrap gap-2">
                  {METRICS.map((m) => (
                    <Button
                      key={m.id}
                      variant={metric === m.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMetricChange(m.id)}
                    >
                      <m.icon className="h-4 w-4 mr-2" />
                      {m.title}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </ErrorBoundaryWrapper>

        {/* Comparison Results */}
        <div className="space-y-8">
          {/* Chart - Using inline component */}
          <ErrorBoundaryWrapper name="comparison chart">
            <ChartTimeseriesCompare
              title={`${selectedMetric?.title ?? "Metric"} Comparison`}
              description="Compare trends across selected regions (London shown as reference)"
              regions={chartRegions}
              unit={selectedMetric?.unit || ""}
              metricId={metric}
              isLoading={!hasAllData && isLoading}
            />
          </ErrorBoundaryWrapper>

          {/* Table */}
          <ErrorBoundaryWrapper name="comparison table">
            <DataTable
              title="Regional Data Comparison"
              description={`${selectedMetric?.title ?? "Metric"} values across selected regions`}
              data={allDisplayRegions.map((regionCode) => ({
                region: regionCode,
                metricId: metric,
                scenario,
                data: comparisonData[regionCode]?.[metric] || [],
              }))}
              unit={selectedMetric?.unit || ""}
              year={new Date().getFullYear()}
              isLoading={!hasAllData && isLoading}
            />
          </ErrorBoundaryWrapper>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <ErrorBoundaryWrapper name="comparison page">
      <Suspense
        fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading comparison...</span>
            </div>
          </div>
        }
      >
        <CompareContent />
      </Suspense>
    </ErrorBoundaryWrapper>
  )
}