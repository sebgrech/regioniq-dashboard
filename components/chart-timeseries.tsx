"use client"

import { useMemo, useState, useCallback, memo } from "react"
import { useTheme } from "next-themes"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
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
  Label,
  Brush,
} from "recharts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatValue, type DataPoint } from "@/lib/data-service"
import type { Scenario } from "@/lib/metrics.config"

type Row = {
  year: number
  baseline?: number | null
  upside?: number | null
  downside?: number | null
  type?: "historical" | "forecast"
  data_quality?: string | null // 'ONS', 'interpolated', or null (for forecasts)
}

interface ChartTimeseriesProps {
  title: string
  description?: string
  /** Baseline rows may be { year,value,type } or { period,value,data_type,ci_upper,ci_lower } */
  data: DataPoint[]
  /** Optional scenario series delivered separately (supported) */
  additionalSeries?: {
    scenario: Scenario // "upside" | "downside"
    data: DataPoint[]
    color?: string
  }[]
  unit: string
  /** Optional: identify what scenario the primary `data` series represents (affects color/legend label). */
  primaryScenario?: Scenario
  /** Presentational only (kept for backwards compatibility with callers). */
  metricId?: string
  isLoading?: boolean
  className?: string
  /** Disable zoom/brush functionality for better performance */
  disableZoom?: boolean
  /** Custom height for the chart (default: 400px) */
  height?: number
}

const COLORS = {
  baseline: "#3b82f6", // blue
  upside: "#10b981",   // green
  downside: "#ef4444", // red
}

export const ChartTimeseries = memo(function ChartTimeseries({
  title,
  description,
  data,
  additionalSeries = [],
  unit,
  primaryScenario = "baseline",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  metricId,
  isLoading = false,
  className,
  disableZoom = false,
  height = 380,
}: ChartTimeseriesProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  
  // Y-axis domain padding constants
  const PAD = 0.25 // 25% extra above max to prevent top tick overlap
  const PAD_BOTTOM = 0.05 // 5% extra below min
  
  // Zoom state - only initialize if zoom is enabled
  const [xDomain, setXDomain] = useState<[number, number] | null>(null)
  const [yDomain, setYDomain] = useState<[number, number] | null>(null)
  const [brushKey, setBrushKey] = useState(0) // Key to force brush remount on reset
  
  /** Normalize/merge into {year, baseline, upside, downside, type} */
  const chartData: Row[] = useMemo(() => {
    if (!data?.length) return []

    const yearMap = new Map<number, Row>()

    const getYear = (r: any) => (r?.year ?? r?.period) as number
    const getType = (r: any): Row["type"] =>
      (r?.type ?? r?.data_type ?? undefined) as Row["type"]

    // Baseline + inline CI (if present)
    for (const r of data as any[]) {
      const y = getYear(r)
      if (y == null) continue
      const row = yearMap.get(y) ?? { year: y }
      row.type ??= getType(r)
      if (r?.value != null) row.baseline = Number(r.value)
      if (r?.ci_upper != null) row.upside = Number(r.ci_upper)
      if (r?.ci_lower != null) row.downside = Number(r.ci_lower)
      // Preserve data_quality from the first data point for this year
      if (r?.data_quality != null && row.data_quality == null) {
        row.data_quality = r.data_quality
      }
      yearMap.set(y, row)
    }

    // Additional scenario series (fallback/augment)
    for (const s of additionalSeries) {
      const scen = s.scenario as "upside" | "downside"
      for (const pt of s.data as any[]) {
        const y = getYear(pt)
        if (y == null) continue
        const row = yearMap.get(y) ?? { year: y }
        row.type ??= getType(pt)
        const v = pt?.value ?? pt?.val ?? pt?.y
        if (v != null) (row as any)[scen] = Number(v)
        yearMap.set(y, row)
      }
    }

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [data, additionalSeries])

  const hasUpside = useMemo(() => chartData.some((r) => r.upside != null), [chartData])
  const hasDownside = useMemo(() => chartData.some((r) => r.downside != null), [chartData])

  const primaryLabel = useMemo(() => {
    if (primaryScenario === "upside") return "Upside"
    if (primaryScenario === "downside") return "Downside"
    return "Baseline"
  }, [primaryScenario])

  const primaryStroke = COLORS[primaryScenario] ?? COLORS.baseline

  // Calculate data ranges for zoom - only if zoom is enabled
  const xRange = useMemo(() => {
    if (disableZoom || !chartData.length) return [0, 0]
    const years = chartData.map(d => d.year)
    return [Math.min(...years), Math.max(...years)]
  }, [chartData, disableZoom])
  
  const yRange = useMemo(() => {
    if (disableZoom || !chartData.length) return [0, 0]
    const allValues = chartData.flatMap(d => [
      d.baseline,
      d.upside,
      d.downside,
    ].filter(v => v != null)) as number[]
    if (!allValues.length) return [0, 0]
    return [Math.min(...allValues), Math.max(...allValues)]
  }, [chartData, disableZoom])
  
  // Zoom handlers - only if zoom is enabled
  const handleZoomIn = useCallback(() => {
    if (disableZoom) return
    if (!xDomain) {
      // Initial zoom: zoom to middle 50%
      const range = xRange[1] - xRange[0]
      const center = (xRange[0] + xRange[1]) / 2
      setXDomain([center - range * 0.25, center + range * 0.25])
    } else {
      // Zoom in further: reduce range by 50%
      const range = xDomain[1] - xDomain[0]
      const center = (xDomain[0] + xDomain[1]) / 2
      const newRange = range * 0.5
      setXDomain([center - newRange / 2, center + newRange / 2])
    }
  }, [xDomain, xRange, disableZoom])
  
  const handleZoomOut = useCallback(() => {
    if (disableZoom || !xDomain) return
    const range = xDomain[1] - xDomain[0]
    const center = (xDomain[0] + xDomain[1]) / 2
    const newRange = Math.min(range * 2, xRange[1] - xRange[0])
    const newDomain: [number, number] = [
      Math.max(xRange[0], center - newRange / 2),
      Math.min(xRange[1], center + newRange / 2),
    ]
    if (newDomain[1] - newDomain[0] >= xRange[1] - xRange[0]) {
      setXDomain(null) // Reset if we've zoomed out fully
    } else {
      setXDomain(newDomain)
    }
  }, [xDomain, xRange, disableZoom])
  
  const handleResetZoom = useCallback(() => {
    if (disableZoom) return
    setXDomain(null)
    setYDomain(null)
    // Force brush to remount by changing key
    setBrushKey(prev => prev + 1)
  }, [disableZoom])
  
  /** First forecast year (tagged or inferred by first CI presence) */
  const firstForecastYear = useMemo(() => {
    const tagged = chartData.find(r => r.type === "forecast")?.year
    if (tagged != null) return tagged
    const firstCI = chartData.find(r => r.upside != null || r.downside != null)?.year
    return firstCI ?? null
  }, [chartData])

  /**  NEW: marker on LAST historical year (or the year immediately before first forecast) */
  const markerYear = useMemo(() => {
    const histYears = chartData.filter(r => r.type === "historical").map(r => r.year)
    if (histYears.length) return Math.max(...histYears)

    if (firstForecastYear == null) return null
    const years = chartData.map(r => r.year)
    const idx = years.indexOf(firstForecastYear)
    if (idx > 0) return years[idx - 1]       // previous existing year in the series
    return years[0] ?? null                   // fallback: start of series
  }, [chartData, firstForecastYear])

  /** Filtered data: Set upside/downside to baseline at last historical year, then diverge */
  const filteredChartData = useMemo(() => {
    if (markerYear == null) {
      // No marker year - show all data as-is
      return chartData
    }
    
    // Find the baseline value at the last historical year
    const lastHistoricalRow = chartData.find(r => r.year === markerYear)
    const baselineAtMarker = lastHistoricalRow?.baseline ?? null
    
    // Use a more efficient approach: create new array only when needed
    const result: Row[] = []
    for (const row of chartData) {
      if (row.year < markerYear) {
        // Before last historical year: remove upside and downside
        result.push({
          ...row,
          upside: null,
          downside: null,
        })
      } else if (row.year === markerYear) {
        // At last historical year: set upside and downside to baseline value
        result.push({
          ...row,
          upside: baselineAtMarker,
          downside: baselineAtMarker,
        })
      } else {
        // After marker year (forecast): keep all values as-is
        result.push(row)
      }
    }
    return result
  }, [chartData, markerYear])

  const handleBrushChange = useCallback((data: { startIndex?: number; endIndex?: number }) => {
    if (disableZoom) return
    if (data.startIndex != null && data.endIndex != null) {
      // Use filteredChartData for brush calculations to match what's displayed
      const startYear = filteredChartData[data.startIndex]?.year
      const endYear = filteredChartData[data.endIndex]?.year
      if (startYear != null && endYear != null) {
        setXDomain([startYear, endYear])
      }
    } else if (data.startIndex == null && data.endIndex == null) {
      // Brush was cleared/reset - reset the domain
      setXDomain(null)
    }
  }, [filteredChartData, disableZoom])

  // Brush indices for zoom state - only if zoom is enabled
  // When xDomain is null, show full range (0 to length-1)
  const brushStartIndex = useMemo(() => {
    if (disableZoom || !filteredChartData.length) return undefined
    if (!xDomain) return 0 // Full range when reset
    const index = filteredChartData.findIndex(d => d.year >= xDomain[0])
    return index >= 0 ? index : 0
  }, [xDomain, filteredChartData, disableZoom])
  const brushEndIndex = useMemo(() => {
    if (disableZoom || !filteredChartData.length) return undefined
    if (!xDomain) return filteredChartData.length - 1 // Full range when reset
    // Find the last index that's <= xDomain[1]
    let index = -1
    for (let i = filteredChartData.length - 1; i >= 0; i--) {
      if (filteredChartData[i].year <= xDomain[1]) {
        index = i
        break
      }
    }
    return index >= 0 ? index : filteredChartData.length - 1
  }, [xDomain, filteredChartData, disableZoom])

  // Axis labels for header badge
  const yearMin = chartData[0]?.year
  const yearMax = chartData[chartData.length - 1]?.year

  // Tooltip with data quality indicator
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const data = payload[0]?.payload as Row
    const rowType = data?.type
    const dataQuality = data?.data_quality
    const dq = String(dataQuality ?? "").toLowerCase()
    
    // Determine quality label and color
    let qualityLabel = ''
    let qualityColor = ''
    
    if (dq === "interpolated" || dq === "estimate" || dq === "estimated") {
      qualityLabel = dq === "interpolated" ? "Estimated (Interpolated)" : "Estimated"
      qualityColor = '#f59e0b' // amber
    } else if (dq === "nisra") {
      qualityLabel = "NISRA"
      qualityColor = '#8b5cf6' // violet
    } else if (dq === "ons") {
      qualityLabel = "ONS"
      qualityColor = '#10b981' // green
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {Math.floor(label)}
          </span>
          <Badge
            variant={rowType === "historical" ? "secondary" : "outline"}
            className="text-xs"
          >
            {rowType === "historical" ? "Historical" : "Forecast"}
          </Badge>
        </div>
        <div className="space-y-1">
          {payload.map((e: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{e.name}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatValue(e.value, unit)}
              </span>
            </div>
          ))}
        </div>
        {/* Data quality indicator */}
        {qualityLabel && (
          <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700" style={{ color: qualityColor }}>
            {qualityLabel}
          </p>
        )}
        {rowType === "forecast" && !qualityLabel && (
          <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            Forecast
          </p>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle><Skeleton className="h-6 w-48" /></CardTitle>
          <CardDescription><Skeleton className="h-4 w-64" /></CardDescription>
        </CardHeader>
        <CardContent><Skeleton className="w-full" style={{ height: `${height}px` }} /></CardContent>
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
          <div className="w-full flex items-center justify-center text-muted-foreground" style={{ height: `${height}px` }}>
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

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
        <div className="w-full" style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <LineChart data={filteredChartData} margin={{ top: 40, right: 72, left: 20, bottom: 15 }}>
              {/* Grid: theme-aware styling */}
              <CartesianGrid
                stroke={gridStroke}
                strokeOpacity={0.4}
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="year"
                type="number"
                domain={disableZoom || !xDomain ? ["dataMin", "dataMax"] : [xDomain[0], xDomain[1]]}
                allowDataOverflow={false}
                tick={{ fontSize: 12, fill: "var(--riq-axis, #6b7280)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[
                  (min) => {
                    const padded = min * (1 - PAD_BOTTOM)
                    return min >= 0 ? Math.max(0, padded) : padded // ensure non-negative values stay non-negative
                  },
                  (max) => max * (1 + PAD), // adds top padding
                ]}
                allowDataOverflow={false}
                tick={{ fontSize: 12, fill: "var(--riq-axis, #6b7280)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Forecast divider on LAST historical year */}
              {markerYear != null && (
                <ReferenceLine x={markerYear} stroke="#9ca3af" strokeDasharray="5 5" strokeOpacity={0.9}>
                  <Label value="Forecast" position="top" dx={40} dy={20} fill="#6b7280" fontSize={12} />
                </ReferenceLine>
              )}

              {/* Baseline */}
              <Line
                type="monotone"
                dataKey="baseline"
                name={primaryLabel}
                stroke={primaryStroke}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              {/* Scenarios (dashed) */}
              {primaryScenario === "baseline" && hasUpside && (
              <Line
                type="monotone"
                dataKey="upside"
                name="Upside"
                stroke={COLORS.upside}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
              )}
              {primaryScenario === "baseline" && hasDownside && (
              <Line
                type="monotone"
                dataKey="downside"
                name="Downside"
                stroke={COLORS.downside}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
              )}

              <Legend
                verticalAlign="bottom"
                align="center"
                layout="horizontal"
                iconType="line"
                wrapperStyle={{
                  paddingTop: 12,
                  // Leave room for the brush when zoom is enabled; harmless when disabled.
                  paddingBottom: disableZoom ? 0 : 2,
                }}
              />
              
              {/* Brush for zooming - only if zoom is enabled */}
              {!disableZoom && (
                <Brush
                  key={`brush-${brushKey}`}
                  dataKey="year"
                  height={30}
                  stroke={isDarkMode ? "#4b5563" : "#9ca3af"}
                  fill={isDarkMode ? "#1f2937" : "#f3f4f6"}
                  onChange={handleBrushChange}
                  startIndex={brushStartIndex}
                  endIndex={brushEndIndex}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Zoom Controls - only if zoom is enabled */}
        {!disableZoom && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                className="h-8"
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                className="h-8"
                disabled={!xDomain}
              >
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="h-8"
                disabled={!xDomain && !yDomain}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {xDomain ? `Showing ${Math.round(xDomain[0])}-${Math.round(xDomain[1])}` : "Showing all data"} • Drag brush to zoom
            </div>
        </div>
        )}
      </CardContent>
    </Card>
  )
})
