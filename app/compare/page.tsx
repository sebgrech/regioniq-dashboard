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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  BarChart,
  Bar,
  Cell,
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

const ChartTimeseriesCompare = ({ 
  title, 
  description, 
  regions, 
  unit, 
  metricId, 
  isLoading, 
  className,
  isIndexed,
  onIndexedChange,
  baseYear,
  onBaseYearChange,
}: any) => {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  
  // Y-axis domain padding constants
  const PAD = 0.15 // 15% extra above max to prevent top tick overlap
  const PAD_BOTTOM = 0.05 // 5% extra below min
  
  // Zoom state
  const [xDomain, setXDomain] = useState<[number, number] | null>(null)
  const [yDomain, setYDomain] = useState<[number, number] | null>(null)
  
  // Premium SaaS color palette (Linear/Stripe inspired)
  const colors = [
    "#6366f1", // Indigo - primary
    "#0ea5e9", // Sky blue
    "#14b8a6", // Teal
    "#f97316", // Orange
    "#ec4899", // Pink
    "#8b5cf6", // Violet
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ]

  // Visibility state for regions
  const [visible, setVisible] = useState<boolean[]>(() => regions.map(() => true))

  useEffect(() => {
    setVisible(regions.map(() => true))
  }, [regions])

  // 1) Compute forecast boundaries PER REGION from API data_type
  // This avoids a single global split year (UK and LAD can differ).
  const regionBoundaries = useMemo(() => {
    return (regions ?? []).map((r: any) => {
      const histYears: number[] = []
      const fcstYears: number[] = []

      for (const pt of r?.data ?? []) {
        const year = (pt.year ?? pt.period) as number
        const t = (pt.type ?? pt.data_type) as "historical" | "forecast" | undefined
        if (year == null) continue
        if (t === "historical") histYears.push(year)
        else if (t === "forecast") fcstYears.push(year)
      }

      const lastHistoricalYear = histYears.length ? Math.max(...histYears) : null
      const forecastStartYear = fcstYears.length ? Math.min(...fcstYears) : null
      return { lastHistoricalYear, forecastStartYear }
    })
  }, [regions])

  // Earliest forecast start year across selected regions.
  // Useful as a visual cue when different regions switch at different times.
  const earliestForecastStartYear = useMemo(() => {
    if (!regionBoundaries.length) return null
    const years = regionBoundaries
      .map((b: { forecastStartYear: number | null }) => b.forecastStartYear)
      .filter((y: number | null): y is number => typeof y === "number")
    if (!years.length) return null
    return Math.min(...years)
  }, [regionBoundaries])

  const hasMixedForecastStart = useMemo(() => {
    const years = regionBoundaries
      .map((b: { forecastStartYear: number | null }) => b.forecastStartYear)
      .filter((y: number | null): y is number => typeof y === "number")
    if (!years.length) return false
    const first = years[0]
    return !years.every((y: number) => y === first)
  }, [regionBoundaries])

  // 2) Build a combined year → values map with SPLIT keys per region:
  //    region{idx}_hist for historical points, region{idx}_fcst for forecast points.
  //    We rely on API `data_type` per point; when missing, we infer using the per-region boundary.
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
      const boundary = regionBoundaries[idx] ?? { lastHistoricalYear: null, forecastStartYear: null }

      for (const pt of data ?? []) {
        const y = (pt.year ?? pt.period) as number
        if (y == null) continue
        const row = yearMap.get(y)!
        const t = (pt.type ?? pt.data_type) as "historical" | "forecast" | undefined

        // Decide forecast vs historical per point.
        // Prefer the provided type; fall back to per-region boundary inference.
        const isForecast = t
          ? t === "forecast"
          : boundary.forecastStartYear != null
            ? y >= boundary.forecastStartYear
            : boundary.lastHistoricalYear != null
              ? y > boundary.lastHistoricalYear
              : false

        if (isForecast) row[kFcst] = pt.value
        else row[kHist] = pt.value
      }
    })

    // Ensure no visible gap at each region's transition:
    // At the FIRST forecast year, copy the forecast point into the historical key (for that one year only)
    // so solid and dashed series touch, while dashed still starts at the forecast year.
    for (let idx = 0; idx < regions.length; idx++) {
      const kHist = `region${idx}_hist`
      const kFcst = `region${idx}_fcst`
      const fs = regionBoundaries[idx]?.forecastStartYear
      if (fs == null) continue
      const row = yearMap.get(fs)
      if (row && row[kFcst] != null && row[kHist] == null) {
        row[kHist] = row[kFcst]
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [regions, regionBoundaries])

  // Available years for index base year dropdown
  const availableBaseYears = useMemo(() => {
    if (!chartData.length) return []
    return chartData.map(d => d.year).sort((a, b) => a - b)
  }, [chartData])

  // Default to first year when indexed mode is enabled
  useEffect(() => {
    if (isIndexed && baseYear === null && availableBaseYears.length) {
      onBaseYearChange?.(availableBaseYears[0])
    }
  }, [isIndexed, baseYear, availableBaseYears, onBaseYearChange])

  // Compute indexed data (rebase all values to 100 at selected base year)
  const indexedChartData = useMemo(() => {
    if (!chartData.length || !regions?.length || baseYear === null) return chartData
    
    // Find base values at the selected base year
    const baseRow = chartData.find(row => row.year === baseYear)
    if (!baseRow) return chartData
    
    const baseValues: Record<string, number> = {}
    for (let idx = 0; idx < regions.length; idx++) {
      const histVal = baseRow[`region${idx}_hist`]
      const fcstVal = baseRow[`region${idx}_fcst`]
      const val = histVal ?? fcstVal
      if (val != null && val !== 0) {
        baseValues[`region${idx}`] = val
      }
    }
    
    // Rebase all values to 100 at selected year
    return chartData.map(row => {
      const newRow: any = { year: row.year, type: row.type }
      for (let idx = 0; idx < regions.length; idx++) {
        const base = baseValues[`region${idx}`]
        if (!base) continue
        
        const histVal = row[`region${idx}_hist`]
        const fcstVal = row[`region${idx}_fcst`]
        
        if (histVal != null) newRow[`region${idx}_hist`] = (histVal / base) * 100
        if (fcstVal != null) newRow[`region${idx}_fcst`] = (fcstVal / base) * 100
      }
      return newRow
    })
  }, [chartData, regions, baseYear])

  // Use indexed or absolute data based on toggle
  const displayData = isIndexed ? indexedChartData : chartData

  // Calculate data ranges for zoom
  const xRange = useMemo(() => {
    if (!displayData.length) return [0, 0]
    const years = displayData.map(d => d.year)
    return [Math.min(...years), Math.max(...years)]
  }, [displayData])

  const yRange = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const row of displayData as any[]) {
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
  }, [displayData])
  
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
      const startYear = displayData[data.startIndex]?.year
      const endYear = displayData[data.endIndex]?.year
      if (startYear != null && endYear != null) {
        setXDomain([startYear, endYear])
      }
    }
  }, [displayData])

  // 3) Custom tooltip (deduces region name from key "region{idx}_hist|_fcst")
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const hasHist = payload.some((e: any) => String(e?.dataKey ?? "").includes("_hist"))
    const hasFcst = payload.some((e: any) => String(e?.dataKey ?? "").includes("_fcst"))
    const rowType = hasHist && hasFcst ? "mixed" : hasFcst ? "forecast" : "historical"
    const seen = new Set<number>() // avoid dup same region from hist/fcst overlap (shouldn't occur, but safe)

    // Recharts does not guarantee payload ordering; enforce region order (region0, region1, ...)
    const orderedPayload = [...payload]
      .filter((e: any) => e?.value != null)
      .sort((a: any, b: any) => {
        const ak = String(a?.dataKey ?? "")
        const bk = String(b?.dataKey ?? "")
        const am = ak.match(/^region(\d+)_/)
        const bm = bk.match(/^region(\d+)_/)
        const ai = am ? parseInt(am[1], 10) : 999
        const bi = bm ? parseInt(bm[1], 10) : 999
        if (ai !== bi) return ai - bi
        // Prefer forecast entries over historical when both exist (transition year),
        // so the tooltip reflects that this year is forecast for that region.
        const aFcst = ak.includes("_fcst")
        const bFcst = bk.includes("_fcst")
        if (aFcst !== bFcst) return aFcst ? -1 : 1
        return String(a?.name ?? ak).localeCompare(String(b?.name ?? bk))
      })

    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 min-w-[180px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{label}</span>
          <Badge
            variant={rowType === "historical" ? "secondary" : "outline"}
            className="text-[10px] px-1.5 py-0"
            title={rowType === "mixed" ? "Some regions are historical, others are forecast in this year" : undefined}
          >
            {rowType === "mixed" ? "Mixed" : rowType === "historical" ? "Historical" : "Forecast"}
          </Badge>
          {isIndexed && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-indigo-600 border-indigo-300">
              Indexed
            </Badge>
          )}
        </div>
        <div className="space-y-0.5">
          {orderedPayload.map((entry: any, i: number) => {
              const m = String(entry.dataKey).match(/^region(\d+)_/)
              const idx = m ? parseInt(m[1], 10) : -1
              if (idx >= 0 && seen.has(idx)) return null
              if (idx >= 0) seen.add(idx)
              const regionName = idx >= 0 ? (regions[idx]?.regionName ?? `Region ${idx + 1}`) : entry.dataKey
              const entryType = String(entry.dataKey).includes("_fcst") ? "Forecast" : "Historical"
              return (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{regionName}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-500">{entryType}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {isIndexed ? entry.value.toFixed(1) : formatValue(entry.value, unit)}
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

  const yearMin = Math.min(...displayData.map((d: any) => d.year))
  const yearMax = Math.max(...displayData.map((d: any) => d.year))

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle - segmented control style */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => onIndexedChange?.(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  !isIndexed 
                    ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Absolute
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isIndexed && availableBaseYears.length) {
                    onBaseYearChange?.(availableBaseYears[0])
                  }
                  onIndexedChange?.(true)
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isIndexed 
                    ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Indexed
              </button>
            </div>
            
            {/* Base year selector (only visible when indexed) */}
            {isIndexed && (
              <Select
                value={baseYear ? String(baseYear) : undefined}
                onValueChange={(v) => onBaseYearChange?.(Number(v))}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Base year" />
                </SelectTrigger>
                <SelectContent>
                  {availableBaseYears.map(year => (
                    <SelectItem key={year} value={String(year)} className="text-xs">
                      {year} = 100
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
          <Badge variant="outline" className="text-xs">
            {yearMin}-{yearMax}
          </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
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
                tickFormatter={(v) => isIndexed ? v.toFixed(0) : formatValue(v, unit)}
                label={isIndexed ? { 
                  value: `Index (${baseYear}=100)`, 
                  angle: -90, 
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#6b7280" },
                  offset: 10
                } : undefined}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Reference line at 100 when indexed */}
              {isIndexed && (
                <ReferenceLine
                  y={100}
                  stroke="#6366f1"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}

              {/* Forecast divider at earliest forecast start year */}
              {earliestForecastStartYear != null && (
                <ReferenceLine
                  x={earliestForecastStartYear}
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
                        {hasMixedForecastStart ? "Forecast (some regions)" : "Forecast"}
                      </text>
                    )
                  }}
                />
              )}

              {/* Render each region as 2 lines: solid historical + dashed forecast (legend only on hist) */}
              {regions.map((region: any, index: number) => {
                const color = region.color || colors[index % colors.length]
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
                startIndex={xDomain ? displayData.findIndex(d => d.year >= xDomain[0]) : undefined}
                endIndex={xDomain ? displayData.findIndex(d => d.year >= xDomain[1]) : undefined}
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
            Forecast is dashed; boundary may vary by region.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// RANK PERSISTENCE HEATMAP
// Shows how each region's ranking changes over time - perfect for OMs
// Rows = regions, Cols = years, Cell = rank position (1st = best)
// ============================================================================

interface RankHeatmapCardProps {
  chartRegions: Array<{
    regionCode: string
    regionName: string
    data: any[]
    color?: string
  }>
  selectedMetric: any
  metric: string
  scenario: string
  regionColorMap: Map<string, string>
  regionColors: string[]
  isLoading: boolean
}

const RankHeatmapCard = ({
  chartRegions,
  selectedMetric,
  metric,
  scenario,
  regionColorMap,
  regionColors,
  isLoading,
}: RankHeatmapCardProps) => {
  // State for year range selection
  const [yearRange, setYearRange] = useState<"10y" | "20y" | "all">("10y")
  
  // Compute all available years from the data
  const allYears = useMemo(() => {
    const years = new Set<number>()
    chartRegions.forEach((region) => {
      region.data?.forEach((d: any) => {
        const y = d.year ?? d.period
        if (y != null) years.add(y)
      })
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [chartRegions])

  // Filter years based on selected range
  const displayYears = useMemo(() => {
    if (yearRange === "all" || allYears.length === 0) return allYears
    
    const currentYear = Math.max(...allYears.filter(y => y <= 2024)) || 2024
    const startYear = yearRange === "10y" ? currentYear - 9 : currentYear - 19
    
    return allYears.filter(y => y >= startYear && y <= currentYear)
  }, [allYears, yearRange])

  // Compute ranks for each region at each year
  // Rank 1 = highest value (best for most metrics like GDHI, population)
  const rankData = useMemo(() => {
    if (chartRegions.length === 0 || displayYears.length === 0) return []
    
    // For each year, collect all values and compute ranks
    const yearRanks: Record<number, Record<string, { rank: number; value: number; total: number }>> = {}
    
    for (const year of displayYears) {
      const yearValues: Array<{ regionCode: string; value: number }> = []
      
      for (const region of chartRegions) {
        const dataPoint = region.data?.find((d: any) => (d.year ?? d.period) === year)
        if (dataPoint?.value != null) {
          yearValues.push({ regionCode: region.regionCode, value: dataPoint.value })
        }
      }
      
      // Sort descending (highest value = rank 1)
      yearValues.sort((a, b) => b.value - a.value)
      
      // Assign ranks
      yearRanks[year] = {}
      yearValues.forEach((item, index) => {
        yearRanks[year][item.regionCode] = {
          rank: index + 1,
          value: item.value,
          total: yearValues.length,
        }
      })
    }
    
    // Build row data for each region
    return chartRegions.map((region) => ({
      regionCode: region.regionCode,
      regionName: region.regionName,
      color: regionColorMap.get(region.regionCode) || regionColors[0],
      ranks: displayYears.map(year => ({
        year,
        ...yearRanks[year]?.[region.regionCode],
      })),
    }))
  }, [chartRegions, displayYears, regionColorMap, regionColors])

  // Color scale: Rank 1 = darkest indigo, worst rank = light
  const getRankColor = useCallback((rank: number, total: number) => {
    if (total <= 1) return "#6366f1" // Single region = primary color
    
    // Normalize rank to 0-1 (0 = best, 1 = worst)
    const normalized = (rank - 1) / (total - 1)
    
    // Gradient from dark indigo (best) to light gray (worst)
    // Best: #4338ca (indigo-700)
    // Good: #6366f1 (indigo-500)
    // Mid: #a5b4fc (indigo-300)
    // Weak: #e0e7ff (indigo-100)
    // Worst: #f1f5f9 (slate-100)
    
    if (normalized < 0.2) return "#4338ca"
    if (normalized < 0.4) return "#6366f1"
    if (normalized < 0.6) return "#818cf8"
    if (normalized < 0.8) return "#a5b4fc"
    return "#c7d2fe"
  }, [])

  // Export data preparation
  const heatmapExportRows = useMemo(() => {
    const rows: any[] = []
    for (const region of rankData) {
      for (const rankInfo of region.ranks) {
        if (rankInfo.rank != null) {
          rows.push({
            Metric: selectedMetric?.title || metric,
            Region: region.regionName,
            "Region Code": region.regionCode,
            Year: rankInfo.year,
            Rank: rankInfo.rank,
            "Total Regions": rankInfo.total,
            Value: rankInfo.value,
            Scenario: scenario,
          })
        }
      }
    }
    return rows
  }, [rankData, selectedMetric?.title, metric, scenario])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rank Trajectory</CardTitle>
          <CardDescription>Tracking relative position over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading rank data...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartRegions.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rank Trajectory</CardTitle>
          <CardDescription>Tracking relative position over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[100px] flex items-center justify-center text-muted-foreground">
            Select at least 2 regions to compare rankings
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ExportableChartCard
      rows={heatmapExportRows}
      csvRows={heatmapExportRows}
      filenameBase={`regioniq_${metric}_rank_trajectory_${scenario}`}
      isLoading={isLoading}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rank Trajectory</CardTitle>
              <CardDescription>
                Track how each region's position changes over time — persistence signals structural advantage
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Year range selector */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setYearRange("10y")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    yearRange === "10y" 
                      ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100" 
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  10Y
                </button>
                <button
                  type="button"
                  onClick={() => setYearRange("20y")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    yearRange === "20y" 
                      ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100" 
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  20Y
                </button>
                <button
                  type="button"
                  onClick={() => setYearRange("all")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    yearRange === "all" 
                      ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100" 
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                  }`}
                >
                  All
                </button>
              </div>
              <Badge variant="outline" className="text-xs">
                {displayYears[0]}–{displayYears[displayYears.length - 1]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-muted-foreground p-2 sticky left-0 bg-background min-w-[160px]">
                    Region
                  </th>
                  {displayYears.map((year) => (
                    <th 
                      key={year} 
                      className={`text-center text-xs font-mono p-1.5 min-w-[36px] ${
                        year === 2024 ? "text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {year.toString().slice(-2)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankData.map((region) => (
                  <tr key={region.regionCode} className="border-t border-muted/30">
                    <td className="text-sm font-medium p-2 sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: region.color }}
                        />
                        <span className="truncate">{region.regionName}</span>
                      </div>
                    </td>
                    {region.ranks.map((rankInfo) => (
                      <td
                        key={rankInfo.year}
                        className="text-center p-1"
                        title={rankInfo.rank != null 
                          ? `${region.regionName}: Rank ${rankInfo.rank} of ${rankInfo.total} (${formatValue(rankInfo.value, selectedMetric?.unit || "")})`
                          : "No data"
                        }
                      >
                        {rankInfo.rank != null ? (
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center text-xs font-semibold mx-auto transition-all hover:scale-110"
                            style={{
                              backgroundColor: getRankColor(rankInfo.rank, rankInfo.total),
                              color: rankInfo.rank <= Math.ceil(rankInfo.total * 0.4) ? "#ffffff" : "#1f2937",
                            }}
                          >
                            {rankInfo.rank}
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted/30 flex items-center justify-center text-xs text-muted-foreground mx-auto">
                            —
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "#4338ca" }} />
                <span>1st (Leading)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "#818cf8" }} />
                <span>Middle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "#c7d2fe" }} />
                <span>Last (Lagging)</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Rank among {chartRegions.length} selected regions • Persistent dark = structural winner
            </div>
          </div>
        </CardContent>
      </Card>
    </ExportableChartCard>
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
  const [barChartYear, setBarChartYear] = useState<number>(year)
  const [barAutoScale, setBarAutoScale] = useState(false)
  
  // Indexed chart state (lifted to page level for exports)
  const [isIndexed, setIsIndexed] = useState(false)
  const [indexBaseYear, setIndexBaseYear] = useState<number | null>(null)

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

  // Stable color palette for regions (same as line chart and bar chart)
  const regionColors = useMemo(() => [
    "#6366f1", // Indigo
    "#0ea5e9", // Sky blue
    "#14b8a6", // Teal
    "#f97316", // Orange
    "#ec4899", // Pink
    "#8b5cf6", // Violet
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ], [])

  // Map each region to a stable color index (based on selection order)
  const regionColorMap = useMemo(() => {
    const map = new Map<string, string>()
    allDisplayRegions.forEach((regionCode, index) => {
      map.set(regionCode, regionColors[index % regionColors.length])
    })
    return map
  }, [allDisplayRegions, regionColors])

  // Prepare data for the new ChartTimeseriesCompare component
  const chartRegions = useMemo(
    () =>
      allDisplayRegions.map((regionCode) => {
        const region = REGIONS.find((r) => r.code === regionCode)
        const data = comparisonData[regionCode]?.[metric] || []
        return {
          regionCode,
          regionName: region?.name || regionCode,
          data,
          color: regionColorMap.get(regionCode) || regionColors[0],
        }
      }),
    [allDisplayRegions, comparisonData, metric, regionColorMap, regionColors],
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

  // Compute indexed export rows (rebase to 100 at selected base year)
  const indexedExportRows = useMemo(() => {
    if (!isIndexed || indexBaseYear === null || !chartRegions.length) return []
    
    // Find base values for each region at the base year
    const baseValues: Record<string, number> = {}
    for (const r of chartRegions) {
      const basePoint = (r.data ?? []).find((pt: any) => (pt.year ?? pt.period) === indexBaseYear)
      if (basePoint?.value != null && basePoint.value !== 0) {
        baseValues[r.regionCode] = basePoint.value
      }
    }
    
    return chartRegions.flatMap((r) =>
      (r.data ?? []).map((pt: any) => {
        const rawValue = pt?.value ?? pt?.val ?? pt?.y
        const base = baseValues[r.regionCode]
        const indexedValue = base && rawValue != null ? (rawValue / base) * 100 : null
        return {
          Metric: `${selectedMetric?.title || metric} (Indexed)`,
          Region: r.regionName,
          "Region Code": r.regionCode,
          Year: pt?.year ?? pt?.period,
          Scenario: scenarioLabel(scenario),
          Value: indexedValue != null ? Math.round(indexedValue * 10) / 10 : null,
          Units: `Index (${indexBaseYear}=100)`,
          "Data Type": dataTypeLabel(pt?.type ?? pt?.data_type),
          Source: sourceLabel({ dataType: pt?.type ?? pt?.data_type, dataQuality: pt?.data_quality }),
        }
      }),
    )
  }, [isIndexed, indexBaseYear, chartRegions, metric, scenario, selectedMetric?.title])

  // Combined export rows: absolute + indexed (when indexed mode is on)
  const combinedExportRows = useMemo(() => {
    if (isIndexed && indexedExportRows.length > 0) {
      return [...chartExportRows, ...indexedExportRows]
    }
    return chartExportRows
  }, [isIndexed, chartExportRows, indexedExportRows])

  const combinedExportCsvRows = useMemo(
    () =>
      combinedExportRows.map((r) => ({
        ...r,
        Value: typeof (r as any).Value === "number" ? Math.round((r as any).Value * 10) / 10 : (r as any).Value,
      })),
    [combinedExportRows],
  )

  // -------- Bar Chart Data --------

  // Available years for the slider
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    chartRegions.forEach((region) => {
      region.data.forEach((d: any) => {
        const y = d.year ?? d.period
        if (y != null) years.add(y)
      })
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [chartRegions])

  // Compute last historical year for bar chart (same logic as line chart)
  const barLastHistoricalYear = useMemo(() => {
    const histYears: number[] = []
    for (const r of chartRegions) {
      for (const pt of r.data ?? []) {
        const year = ((pt as any).year ?? (pt as any).period) as number
        const t = ((pt as any).type ?? (pt as any).data_type) as string | undefined
        if (year != null && t === "historical") histYears.push(year)
      }
    }
    return histYears.length ? Math.max(...histYears) : null
  }, [chartRegions])

  // Bar chart data for static year comparison
  const barChartData = useMemo(() => {
    return chartRegions
      .map((region) => {
        const yearData = region.data.find(
          (d: any) => (d.year ?? d.period) === barChartYear
        )
        
        // Determine data type properly (same logic as line chart)
        // Use explicit type if available, otherwise infer from last historical year
        const explicitType = yearData?.type ?? (yearData as any)?.data_type
        const inferredType = explicitType 
          ? explicitType 
          : (barLastHistoricalYear != null && barChartYear <= barLastHistoricalYear)
            ? "historical"
            : "forecast"
        
        return {
          regionCode: region.regionCode,
          regionName: region.regionName,
          value: yearData?.value ?? null,
          dataType: inferredType,
        }
      })
      .filter((d) => d.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  }, [chartRegions, barChartYear, barLastHistoricalYear])

  // Fixed X-axis domain for the snapshot chart:
  // compute over ALL selected regions and ALL available years so scrubbing doesn't re-scale.
  const barFixedDomain = useMemo((): [number, number] => {
    const values: number[] = []
    for (const region of chartRegions) {
      for (const pt of region.data ?? []) {
        const v = (pt as any)?.value
        if (typeof v === "number" && Number.isFinite(v)) values.push(v)
      }
    }
    if (!values.length) return [0, 1]
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (min === max) {
      // Avoid zero-width domains
      const bump = min === 0 ? 1 : Math.abs(min) * 0.05
      min = min - bump
      max = max + bump
    }
    // Avoid negative lower bounds when the whole series is non-negative
    if (min >= 0) min = 0
    const range = max - min
    const pad = range > 0 ? range * 0.05 : Math.abs(max) * 0.05
    return [min, max + pad]
  }, [chartRegions])

  // Auto domain for the snapshot chart (per selected year).
  // For bars, starting from zero is almost always the least misleading default.
  const barAutoDomain = useMemo((): [number, number] => {
    const values = barChartData
      .map((d) => d.value)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    if (!values.length) return [0, 1]
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min >= 0) {
      const pad = max === 0 ? 1 : max * 0.05
      return [0, max + pad]
    }
    // Mixed/negative values: pad both ends
    const range = max - min
    const pad = range > 0 ? range * 0.05 : Math.abs(max || 1) * 0.05
    return [min - pad, max + pad]
  }, [barChartData])

  // Bar chart export rows
  const barChartExportRows = useMemo(() => {
    const unit = selectedMetric?.unit || ""
    return barChartData.map((d) => ({
      Metric: selectedMetric?.title || metric,
      Region: d.regionName,
      "Region Code": d.regionCode,
      Year: barChartYear,
      Scenario: scenarioLabel(scenario),
      Value: d.value,
      Units: unit,
      "Data Type": dataTypeLabel(d.dataType),
    }))
  }, [barChartData, barChartYear, metric, scenario, selectedMetric?.title, selectedMetric?.unit])

  const barChartExportCsvRows = useMemo(
    () =>
      barChartExportRows.map((r) => ({
        ...r,
        Value: typeof r.Value === "number" ? Math.round(r.Value) : r.Value,
      })),
    [barChartExportRows],
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
                  rows={combinedExportRows}
                  csvRows={combinedExportCsvRows}
                  filenameBase={`regioniq_${metric}_comparison_${scenario}${isIndexed ? "_indexed" : ""}`}
                  isLoading={!hasAllData && isLoading}
                  serverXlsxRequest={{
                    metricId: metric,
                    regionCodes: allDisplayRegions,
                    scenario,
                  }}
                >
                  <ChartTimeseriesCompare
                    title={`${selectedMetric?.title ?? "Metric"} Over Time`}
                    description="Historical trends and forecast trajectories"
                    regions={chartRegions}
                    unit={selectedMetric?.unit || ""}
                    metricId={metric}
                    isLoading={!hasAllData && isLoading}
                    isIndexed={isIndexed}
                    onIndexedChange={setIsIndexed}
                    baseYear={indexBaseYear}
                    onBaseYearChange={setIndexBaseYear}
                  />
                </ExportableChartCard>
            </ErrorBoundaryWrapper>

          {/* Static Year Bar Chart */}
          <ErrorBoundaryWrapper name="bar chart comparison">
            <ExportableChartCard
              rows={barChartExportRows}
              csvRows={barChartExportCsvRows}
              filenameBase={`regioniq_${metric}_${barChartYear}_comparison_${scenario}`}
              isLoading={!hasAllData && isLoading}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedMetric?.title ?? "Metric"} Snapshot</CardTitle>
                      <CardDescription>
                        Point-in-time ranking by region
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                        <button
                          type="button"
                          onClick={() => setBarAutoScale(false)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            !barAutoScale
                              ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100"
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          }`}
                          title="Keep a fixed scale across years"
                        >
                          Fixed
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarAutoScale(true)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            barAutoScale
                              ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100"
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          }`}
                          title="Auto-fit the scale to the selected year"
                        >
                          Auto
                        </button>
                      </div>
                      {barChartYear > YEARS.forecastStart && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Forecast
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-sm font-mono font-semibold">
                        {barChartYear}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Year Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">
                        Select Year
                      </label>
                    </div>
                    <input
                      type="range"
                      min={availableYears[0] ?? YEARS.min}
                      max={availableYears[availableYears.length - 1] ?? YEARS.max}
                      value={barChartYear}
                      onChange={(e) => setBarChartYear(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>2010</span>
                      <span>2020</span>
                      <span className="text-primary font-medium">2024</span>
                      <span>2030</span>
                      <span>2040</span>
                      <span>2050</span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  {barChartData.length > 0 ? (
                    <div 
                      className="w-full"
                      style={{ height: Math.max(120, Math.min(500, barChartData.length * 50 + 40)) }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={barChartData}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                          barSize={32}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={true} vertical={false} />
                          <XAxis
                            type="number"
                            domain={barAutoScale ? barAutoDomain : barFixedDomain}
                            tickFormatter={(v) => formatValue(v, selectedMetric?.unit || "", 1)}
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            axisLine={{ stroke: "#e5e7eb" }}
                            tickLine={{ stroke: "#e5e7eb" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="regionName"
                            width={180}
                            tick={{ fontSize: 14, fill: "#374151", fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: "transparent" }}
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null
                              const entry = payload[0]
                              const dataPoint = barChartData.find(d => d.regionName === label)
                              const regionColor = dataPoint ? regionColorMap.get(dataPoint.regionCode) : regionColors[0]
                              return (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 min-w-[180px]">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{label}</span>
                                    <Badge variant={dataPoint?.dataType === "historical" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                                      {dataPoint?.dataType === "historical" ? "Historical" : "Forecast"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: regionColor }} />
                                      <span className="text-xs text-gray-500 dark:text-gray-400">{barChartYear}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                      {formatValue(entry?.value as number, selectedMetric?.unit || "", 1)}
                                    </span>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar 
                            dataKey="value" 
                            radius={[0, 4, 4, 0]}
                            isAnimationActive={true}
                            animationDuration={400}
                            animationEasing="ease-out"
                          >
                            {barChartData.map((entry) => (
                              <Cell
                                key={`cell-${entry.regionCode}`}
                                fill={regionColorMap.get(entry.regionCode) || regionColors[0]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      No data available for {barChartYear}
                    </div>
                  )}
                </CardContent>
              </Card>
                </ExportableChartCard>
            </ErrorBoundaryWrapper>

          {/* Rank Trajectory (heatmap) is temporarily hidden for V1 */}

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