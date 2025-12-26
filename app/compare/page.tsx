"use client"

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, X, ZoomIn, ZoomOut, RotateCcw, GitCompareArrows, Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RegionPicker } from "@/components/region-picker"
// DataTable removed - using Data Explorer link instead
// import { DataTable } from "@/components/data-table"
// ExportMenu removed from header - users export via Data Explorer
// import { ExportMenu } from "@/components/export-menu"
import { ExportableChartCard } from "@/components/exportable-chart-card"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"
import { ErrorBoundaryWrapper } from "@/components/error-boundary"
import { CompareCopilot, type CompareSuggestedAction } from "@/components/compare-copilot"

import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { getSearchParam, getSearchParamNumber, updateSearchParams } from "@/lib/utils"
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
  Brush,
} from "recharts"
import { formatValue } from "@/lib/data-service"
import { YEARS } from "@/lib/metrics.config"

const ChartTimeseriesCompare = ({ title, description, regions, unit, metricId, isLoading, className }: any) => {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  
  // Y-axis domain padding constants
  const PAD = 0.15 // 15% extra above max to prevent top tick overlap
  const PAD_BOTTOM = 0.05 // 5% extra below min
  
  // Zoom state
  const [xDomain, setXDomain] = useState<[number, number] | null>(null)
  const [yDomain, setYDomain] = useState<[number, number] | null>(null)
  
  // Palette
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

  // Visibility state for regions
  const [visible, setVisible] = useState<boolean[]>(() => regions.map(() => true))

  useEffect(() => {
    setVisible(regions.map(() => true))
  }, [regions])

  // 1) Compute the LAST historical year across all supplied region series
  const lastHistoricalYear = useMemo(() => {
    const histYears: number[] = []
    for (const r of regions ?? []) {
      for (const pt of r?.data ?? []) {
        const year = (pt.year ?? pt.period) as number
        const t = (pt.type ?? pt.data_type) as "historical" | "forecast" | undefined
        if (year != null && t === "historical") histYears.push(year)
      }
    }
    if (!histYears.length) return null
    return Math.max(...histYears)
  }, [regions])

  // 2) Build a combined year → values map with SPLIT keys per region:
  //    region{idx}_hist for years <= lastHistoricalYear, region{idx}_fcst for > lastHistoricalYear.
  //    We also tag each row's "type" so the tooltip shows Historical/Forecast correctly.
  const chartData = useMemo(() => {
    if (!regions?.length) return []

    const yearMap = new Map<number, any>()

    // Collect all years first
    for (const { data } of regions) {
      for (const pt of data ?? []) {
        const y = (pt.year ?? pt.period) as number
        if (y == null) continue
        if (!yearMap.has(y)) yearMap.set(y, { year: y })
      }
    }

    // Fill rows per region with split hist/fcst keys
    regions.forEach(({ data }: any, idx: number) => {
      const kHist = `region${idx}_hist`
      const kFcst = `region${idx}_fcst`

      for (const pt of data ?? []) {
        const y = (pt.year ?? pt.period) as number
        if (y == null) continue
        const row = yearMap.get(y)!
        const t = (pt.type ?? pt.data_type) as "historical" | "forecast" | undefined

        // Decide forecast vs historical per point.
        // Prefer the provided type; fall back to the lastHistoricalYear threshold.
        const isForecast = t ? t === "forecast" : (lastHistoricalYear != null ? y > lastHistoricalYear : false)

        if (isForecast) row[kFcst] = pt.value
        else row[kHist] = pt.value
      }
    })

    // To connect the lines without gap, duplicate the last historical value into the forecast key for each region
    if (lastHistoricalYear != null) {
      for (let idx = 0; idx < regions.length; idx++) {
        const kHist = `region${idx}_hist`
        const kFcst = `region${idx}_fcst`
        const row = yearMap.get(lastHistoricalYear)
        if (row && row[kHist] != null && row[kFcst] == null) {
          row[kFcst] = row[kHist]
        }
      }
    }

    // Tag the row type by the year threshold so tooltip stays consistent across regions
    for (const row of yearMap.values()) {
      row.type = lastHistoricalYear != null && row.year <= lastHistoricalYear ? "historical" : "forecast"
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [regions, lastHistoricalYear])

  // Calculate data ranges for zoom
  const xRange = useMemo(() => {
    if (!chartData.length) return [0, 0]
    const years = chartData.map(d => d.year)
    return [Math.min(...years), Math.max(...years)]
  }, [chartData])

  const yRange = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const row of chartData as any[]) {
      for (const [k, v] of Object.entries(row)) {
        if (k === "year" || k === "type") continue
        if (typeof v !== "number" || !Number.isFinite(v)) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0] as [number, number]
    // Avoid negative lower bounds when the whole series is non-negative
    if (min >= 0) min = Math.max(0, min)
    return [min, max] as [number, number]
  }, [chartData])
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (!xDomain) {
      const range = xRange[1] - xRange[0]
      const center = (xRange[0] + xRange[1]) / 2
      setXDomain([center - range * 0.25, center + range * 0.25])
    } else {
      const range = xDomain[1] - xDomain[0]
      const center = (xDomain[0] + xDomain[1]) / 2
      const newRange = range * 0.5
      setXDomain([center - newRange / 2, center + newRange / 2])
    }
  }, [xDomain, xRange])
  
  const handleZoomOut = useCallback(() => {
    if (!xDomain) return
    const range = xDomain[1] - xDomain[0]
    const center = (xDomain[0] + xDomain[1]) / 2
    const newRange = Math.min(range * 2, xRange[1] - xRange[0])
    const newDomain: [number, number] = [
      Math.max(xRange[0], center - newRange / 2),
      Math.min(xRange[1], center + newRange / 2),
    ]
    if (newDomain[1] - newDomain[0] >= xRange[1] - xRange[0]) {
      setXDomain(null)
    } else {
      setXDomain(newDomain)
    }
  }, [xDomain, xRange])
  
  const handleResetZoom = useCallback(() => {
    setXDomain(null)
    setYDomain(null)
  }, [])

  const handleYZoomIn = useCallback(() => {
    const fullRange = yRange[1] - yRange[0]
    if (fullRange <= 0) return

    if (!yDomain) {
      const center = (yRange[0] + yRange[1]) / 2
      setYDomain([center - fullRange * 0.25, center + fullRange * 0.25])
    } else {
      const range = yDomain[1] - yDomain[0]
      const center = (yDomain[0] + yDomain[1]) / 2
      const newRange = range * 0.5
      setYDomain([center - newRange / 2, center + newRange / 2])
    }
  }, [yDomain, yRange])

  const handleYZoomOut = useCallback(() => {
    if (!yDomain) return
    const fullRange = yRange[1] - yRange[0]
    if (fullRange <= 0) return

    const range = yDomain[1] - yDomain[0]
    const center = (yDomain[0] + yDomain[1]) / 2
    const newRange = Math.min(range * 2, fullRange)
    const newDomain: [number, number] = [
      Math.max(yRange[0], center - newRange / 2),
      Math.min(yRange[1], center + newRange / 2),
    ]
    if (newDomain[1] - newDomain[0] >= fullRange) {
      setYDomain(null)
    } else {
      setYDomain(newDomain)
    }
  }, [yDomain, yRange])

  const handleResetYZoom = useCallback(() => {
    setYDomain(null)
  }, [])
  
  const handleBrushChange = useCallback((data: { startIndex?: number; endIndex?: number }) => {
    if (data.startIndex != null && data.endIndex != null) {
      const startYear = chartData[data.startIndex]?.year
      const endYear = chartData[data.endIndex]?.year
      if (startYear != null && endYear != null) {
        setXDomain([startYear, endYear])
      }
    }
  }, [chartData])

  // 3) Custom tooltip (deduces region name from key "region{idx}_hist|_fcst")
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const rowType = payload[0]?.payload?.type
    const seen = new Set<number>() // avoid dup same region from hist/fcst overlap (shouldn't occur, but safe)

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
          <Badge variant={rowType === "historical" ? "secondary" : "outline"} className="text-xs">
            {rowType === "historical" ? "Historical" : "Forecast"}
          </Badge>
        </div>
        <div className="space-y-1">
          {payload
            .filter((e: any) => e.value != null)
            .map((entry: any, i: number) => {
              const m = String(entry.dataKey).match(/^region(\d+)_/)
              const idx = m ? parseInt(m[1], 10) : -1
              if (idx >= 0 && seen.has(idx)) return null
              if (idx >= 0) seen.add(idx)
              const regionName = idx >= 0 ? (regions[idx]?.regionName ?? `Region ${idx + 1}`) : entry.dataKey
              return (
                <div key={i} className="flex items-center justify-between gap-4">
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

  if (!chartData.length) {
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

  const yearMin = Math.min(...chartData.map((d: any) => d.year))
  const yearMax = Math.max(...chartData.map((d: any) => d.year))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline" className="text-xs">
            {yearMin}-{yearMax}
          </Badge>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <div className="h-[640px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid
                stroke={gridStroke}
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="year"
                type="number"
                domain={xDomain ? [xDomain[0], xDomain[1]] : ["dataMin", "dataMax"]}
                allowDataOverflow={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                domain={
                  yDomain
                    ? [
                        (minValue: number) => {
                          const isNonNegative = yRange[0] >= 0
                          const hardMin = isNonNegative ? 0 : Number.NEGATIVE_INFINITY
                          return Math.max(hardMin, yDomain[0], minValue)
                        },
                        (maxValue: number) => Math.min(yDomain[1], maxValue),
                      ]
                    : [
                        (min) => {
                          const padded = min * (1 - PAD_BOTTOM)
                          return min >= 0 ? Math.max(0, padded) : padded // ensure non-negative values stay non-negative
                        },
                        (max) => max * (1 + PAD), // adds top padding
                      ]
                }
                allowDataOverflow={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Forecast divider on LAST historical year */}
              {lastHistoricalYear != null && (
                <ReferenceLine
                  x={lastHistoricalYear}
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  strokeOpacity={0.8}
                  label={({ viewBox }: any) => {
                    const { x } = viewBox
                    return (
                      <text 
                        x={x + 5} 
                        y={40} 
                        fill="#6b7280" 
                        fontSize={12}
                        textAnchor="start"
                      >
                        Forecast
                      </text>
                    )
                  }}
                />
              )}

              {/* Render each region as 2 lines: solid historical + dashed forecast (legend only on hist) */}
              {regions.map((region: any, index: number) => {
                const color = colors[index % colors.length]
                const kHist = `region${index}_hist`
                const kFcst = `region${index}_fcst`
                const isVisible = visible[index]
                return (
                  <React.Fragment key={`region-lines-${index}`}>
                    <Line
                      type="monotone"
                      dataKey={kHist}
                      name={region.regionName}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                      hide={!isVisible}
                    />
                    <Line
                      type="monotone"
                      dataKey={kFcst}
                      name={region.regionName}
                      stroke={color}
                      strokeWidth={2.5}
                      strokeDasharray="6 3"   // <-- dashed from forecast
                      dot={false}
                      connectNulls={false}
                      legendType="none"       // keep legend single per region
                      hide={!isVisible}
                    />
                  </React.Fragment>
                )
              })}

              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value, entry: any) => {
                  // Extract region index from dataKey (e.g., "region0_hist" -> 0)
                  const m = String(value).match(/^region(\d+)/)
                  const idx = m ? parseInt(m[1], 10) : -1
                  return idx >= 0 ? (regions[idx]?.regionName || value) : value
                }}
                onClick={(e: any) => {
                  const dataKey = e.dataKey
                  const m = String(dataKey).match(/^region(\d+)/)
                  const idx = m ? parseInt(m[1], 10) : -1
                  if (idx >= 0) {
                    setVisible((prev) =>
                      prev.map((v, i) => (i === idx ? !v : v))
                    )
                  }
                }}
              />
              
              {/* Brush for zooming */}
              <Brush
                dataKey="year"
                height={30}
                stroke={isDarkMode ? "#4b5563" : "#9ca3af"}
                fill={isDarkMode ? "#1f2937" : "#f3f4f6"}
                onChange={handleBrushChange}
                startIndex={xDomain ? chartData.findIndex(d => d.year >= xDomain[0]) : undefined}
                endIndex={xDomain ? chartData.findIndex(d => d.year >= xDomain[1]) : undefined}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Zoom Controls */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">X</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn} className="h-8">
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut} className="h-8" disabled={!xDomain}>
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom} className="h-8" disabled={!xDomain}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Y</span>
              <Button variant="outline" size="sm" onClick={handleYZoomIn} className="h-8" disabled={yRange[1] - yRange[0] <= 0}>
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button variant="outline" size="sm" onClick={handleYZoomOut} className="h-8" disabled={!yDomain}>
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetYZoom} className="h-8" disabled={!yDomain}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {xDomain ? `X: ${Math.round(xDomain[0])}-${Math.round(xDomain[1])}` : "X: all"}{" "}
            •{" "}
            {yDomain ? `Y: ${formatValue(yDomain[0], unit)}–${formatValue(yDomain[1], unit)}` : "Y: all"}{" "}
            • Drag brush to zoom X
          </div>
        </div>

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
            Divider marks last historical year • forecast is dashed.
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

const MAX_COMPARE_REGIONS = 12

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // -------- URL state --------
  // Support both:
  // - canonical: ?regions=A,B,C
  // - legacy/dashboard links: ?region=A
  const regionsParam = getSearchParam(searchParams, "regions", "")
  const legacyRegion = getSearchParam(searchParams, "region", "")
  const defaultMetric = METRICS.find((m) => m.id === "population_total")?.id ?? METRICS[0]?.id ?? "population_total"
  const metric = getSearchParam(searchParams, "metric", defaultMetric)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario
  const year = getSearchParamNumber(searchParams, "year", 2024)

  // Normalize URL on entry so the page is never “blank”:
  // If coming from dashboard with ?region=UKI, rewrite to ?regions=UKI and ensure a valid metric id.
  useEffect(() => {
    const hasRegions = Boolean(regionsParam.split(",").filter(Boolean).length)
    const validMetric = Boolean(METRICS.find((m) => m.id === metric))
    if (hasRegions && validMetric) return

    const updates: Record<string, string | null> = {}
    if (!hasRegions && legacyRegion) updates.regions = legacyRegion
    if (!validMetric) updates.metric = defaultMetric
    if (Object.keys(updates).length === 0) return

    const newParams = updateSearchParams(searchParams, updates)
    router.replace(`/compare?${newParams}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMetric, legacyRegion, metric, regionsParam])

  const selectedRegions = useMemo(
    () => {
      const fromRegions = regionsParam.split(",").filter(Boolean)
      if (fromRegions.length) return fromRegions
      if (legacyRegion) return [legacyRegion]
      return []
    },
    [legacyRegion, regionsParam],
  )

  // All regions to display (no pinned region - all are selectable)
  const allDisplayRegions = useMemo(
    () => Array.from(new Set(selectedRegions)),
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
      updateURL({ regions: regionsArray.join(",") })
    },
    [updateURL],
  )

  const handleMetricChange = useCallback(
    (newMetric: string) => updateURL({ metric: newMetric }),
    [updateURL],
  )

  const addRegion = useCallback(
    (regionCode: string) => {
      if (!selectedRegions.includes(regionCode) && selectedRegions.length < MAX_COMPARE_REGIONS) {
        handleRegionsChange([...selectedRegions, regionCode])
      }
    },
    [handleRegionsChange, selectedRegions],
  )

  const removeRegion = useCallback(
    (regionToRemove: string) => {
        const newRegions = selectedRegions.filter((r) => r !== regionToRemove)
        handleRegionsChange(newRegions)
    },
    [handleRegionsChange, selectedRegions],
  )

  // -------- UI prep (memoized to avoid chart re-mounts) --------
  const selectedMetric = useMemo(() => METRICS.find((m) => m.id === metric), [metric])

  const regionChips: RegionChip[] = useMemo(
    () =>
      selectedRegions.map((code) => ({
          code,
          name: REGIONS.find((r) => r.code === code)?.name || code,
        })),
    [selectedRegions],
  )

  const selectedRegionsMeta = useMemo(
    () =>
      selectedRegions.map((code) => {
        const r = REGIONS.find((x) => x.code === code)
        return { code, name: r?.name || code, level: r?.level }
      }),
    [selectedRegions],
  )

  const applyCopilotAction = useCallback(
    (action: CompareSuggestedAction) => {
      const uniq = (arr: string[]) => Array.from(new Set(arr))
      let next: string[] = selectedRegions

      if (action.type === "addRegions") {
        next = uniq([...selectedRegions, ...action.regionCodes]).slice(0, MAX_COMPARE_REGIONS)
      } else if (action.type === "removeRegions") {
        next = selectedRegions.filter((c) => !action.regionCodes.includes(c))
      } else if (action.type === "replaceRegions") {
        next = uniq(action.regionCodes).slice(0, MAX_COMPARE_REGIONS)
      }

      handleRegionsChange(next)
    },
    [handleRegionsChange, selectedRegions],
  )

  // Prepare data for the new ChartTimeseriesCompare component
  const chartRegions = useMemo(
    () =>
      allDisplayRegions.map((regionCode, index) => {
        const region = REGIONS.find((r) => r.code === regionCode)
        const data = comparisonData[regionCode]?.[metric] || []
        return {
          regionCode,
          regionName: region?.name || regionCode,
          data,
          color: `hsl(var(--chart-${(index % 5) + 1}))`,
        }
      }),
    [allDisplayRegions, comparisonData, metric],
  )

  const chartExportRows = useMemo(() => {
    const unit = selectedMetric?.unit || ""
    return chartRegions.flatMap((r) =>
      (r.data ?? []).map((pt: any) => ({
        Metric: selectedMetric?.title || metric,
        Region: r.regionName,
        "Region Code": r.regionCode,
        Year: pt?.year ?? pt?.period,
        Scenario: scenarioLabel(scenario),
        Value: pt?.value ?? pt?.val ?? pt?.y,
        Units: unit,
        "Data Type": dataTypeLabel(pt?.type ?? pt?.data_type),
        Source: sourceLabel({ dataType: pt?.type ?? pt?.data_type, dataQuality: pt?.data_quality }),
      })),
    )
  }, [chartRegions, metric, scenario, selectedMetric?.title, selectedMetric?.unit])

  const chartExportCsvRows = useMemo(
    () =>
      chartExportRows.map((r) => ({
        ...r,
        Value: typeof (r as any).Value === "number" ? Math.round((r as any).Value) : (r as any).Value,
      })),
    [chartExportRows],
  )

  // URL to open this comparison in the Data Explorer with prefilled selections
  const dataExplorerUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set("metric", metric)
    params.set("regions", selectedRegions.join(","))
    params.set("scenario", scenario)
    params.set("year", String(year))
    return `/data?${params.toString()}`
  }, [metric, selectedRegions, scenario, year])

  return (
    <div className="min-h-screen bg-background">
      {/* Header - matches DashboardControls layout */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-2 flex items-center justify-between">
          <div className="flex items-center">
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
                <Link href={`/dashboard?region=${selectedRegions[0] || ""}&year=${year}&scenario=${scenario}`}>
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>

              <div className="h-10 w-px bg-border" />

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GitCompareArrows className="h-4 w-4 text-primary" />
              </div>
                <h1 className="text-lg font-semibold">Regional Comparison</h1>
            </div>
          </div>
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
                Select regions and metrics to compare (max {MAX_COMPARE_REGIONS} regions)
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
                      variant="secondary"
                      className="gap-2 px-3 py-1"
                    >
                      <span>{chip.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => removeRegion(chip.code)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                    </Badge>
                  ))}

                  {selectedRegions.length < MAX_COMPARE_REGIONS && (
                    <RegionPicker
                      value=""
                      onValueChange={(value) => {
                        if (typeof value === "string" && value) {
                          addRegion(value)
                        }
                      }}
                      placeholder="Add region..."
                      exclude={selectedRegions}
                    />
                  )}
                </div>

                {selectedRegions.length === MAX_COMPARE_REGIONS && (
                  <p className="text-xs text-muted-foreground">
                    Maximum regions reached ({MAX_COMPARE_REGIONS} regions)
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
          {/* Chart - Full width now that Copilot is hidden */}
            <ErrorBoundaryWrapper name="comparison chart">
                <ExportableChartCard
                  rows={chartExportRows}
                  csvRows={chartExportCsvRows}
                  filenameBase={`regioniq_${metric}_comparison_${scenario}`}
                  isLoading={!hasAllData && isLoading}
                  serverXlsxRequest={{
                    metricId: metric,
                    regionCodes: allDisplayRegions,
                    scenario,
                  }}
                >
                  <ChartTimeseriesCompare
                    title={`${selectedMetric?.title ?? "Metric"} Comparison`}
                    description="Compare trends across selected regions"
                    regions={chartRegions}
                    unit={selectedMetric?.unit || ""}
                    metricId={metric}
                    isLoading={!hasAllData && isLoading}
                  />
                </ExportableChartCard>
            </ErrorBoundaryWrapper>

          {/* Compare Copilot - HIDDEN FOR V1: Component exists but is not rendered
              To re-enable, uncomment the section below:
            <ErrorBoundaryWrapper name="compare copilot">
              <CompareCopilot
                metricId={metric}
                metricTitle={selectedMetric?.title ?? metric}
                scenario={scenario}
                year={year}
                selectedRegions={selectedRegionsMeta}
                maxRegions={MAX_COMPARE_REGIONS}
                onApplyAction={applyCopilotAction}
              />
            </ErrorBoundaryWrapper>
          */}

          {/* Data Explorer CTA */}
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Database className="h-7 w-7 text-primary" />
        </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Explore the Data</h3>
                  <p className="text-muted-foreground max-w-md">
                    View detailed tables, select additional years, and export {selectedMetric?.title ?? "metric"} data 
                    for {selectedRegions.length} selected region{selectedRegions.length !== 1 ? "s" : ""}.
                  </p>
                </div>
                <Button size="lg" asChild className="mt-2">
                  <Link href={dataExplorerUrl}>
                    <Database className="h-5 w-5 mr-2" />
                    Open in Data Explorer
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
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