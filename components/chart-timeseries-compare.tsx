"use client"

import { useMemo, useState, useCallback } from "react"
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
  Legend,
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
import { formatValue } from "@/lib/data-service"

const ChartTimeseriesCompare = ({
  title,
  description,
  regions,
  unit,
  metricId,
  isLoading = false,
  className,
}: {
  title: string
  description?: string
  regions: any[]
  unit: string
  metricId: string
  isLoading?: boolean
  className?: string
}) => {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  
  // Y-axis domain padding constants
  const PAD = 0.15 // 15% extra above max to prevent top tick overlap
  const PAD_BOTTOM = 0.05 // 5% extra below min
  
  // Zoom state
  const [xDomain, setXDomain] = useState<[number, number] | null>(null)
  const [yDomain, setYDomain] = useState<[number, number] | null>(null)
  const chartData = useMemo(() => {
    if (!regions?.length) return []

    const yearMap = new Map<number, any>()

    // Collect all years across all regions
    regions.forEach(({ data }) => {
      data?.forEach((pt: any) => {
        if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
      })
    })

    // Populate values, split hist vs forecast
    regions.forEach(({ regionName, data }, index) => {
      const baseKey = `region${index}`
      data?.forEach((pt: any) => {
        const row = yearMap.get(pt.year)
        if (!row) return
        if (pt.type === "historical") {
          row[`${baseKey}_hist`] = pt.value
        } else if (pt.type === "forecast") {
          row[`${baseKey}_fcst`] = pt.value
        }
        row[`${baseKey}_name`] = regionName
      })
    })

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [regions])

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
        if (k === "year") continue
        if (typeof v !== "number" || !Number.isFinite(v)) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0] as [number, number]
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

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Loading…</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">Loading chart…</div>
        </CardContent>
      </Card>
    )
  }

  if (!chartData.length) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full">
          <ResponsiveContainer>
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
              />
              <YAxis
                domain={
                  yDomain
                    ? [yDomain[0], yDomain[1]]
                    : [
                  (min) => {
                    const padded = min * (1 - PAD_BOTTOM)
                    return min >= 0 ? Math.max(0, padded) : padded
                  },
                  (max) => max * (1 + PAD),
                      ]
                }
                allowDataOverflow={false}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  
                  // Get data quality from the first payload (all should have same year)
                  const firstPayload = payload[0]
                  const data = firstPayload?.payload
                  
                  // Try to get data_quality from any of the regions' data
                  let dataQuality: string | null = null
                  if (data) {
                    // Check if any region has data_quality in the original data
                    regions.forEach(({ data: regionData }) => {
                      const yearData = regionData?.find((d: any) => d.year === label)
                      if (yearData?.data_quality && !dataQuality) {
                        dataQuality = yearData.data_quality
                      }
                    })
                  }
                  
                  // Determine quality label and color
                  let qualityLabel = ''
                  let qualityColor = ''
                  
                  if (dataQuality === 'interpolated') {
                    qualityLabel = 'Estimated (Interpolated)'
                    qualityColor = '#f59e0b' // amber
                  } else if (dataQuality === 'ONS') {
                    qualityLabel = 'ONS'
                    qualityColor = '#10b981' // green
                  }
                  
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
                      <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Year: {Math.floor(label)}
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
                    </div>
                  )
                }}
              />
              {regions.map((region, index) => {
                const baseKey = `region${index}`
                const stroke = colors[index % colors.length]
                return (
                  <>
                    {/* Historical = solid */}
                    <Line
                      key={`${baseKey}_hist`}
                      type="monotone"
                      dataKey={`${baseKey}_hist`}
                      name={`${region.regionName} (Hist)`}
                      stroke={stroke}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    {/* Forecast = dashed */}
                    <Line
                      key={`${baseKey}_fcst`}
                      type="monotone"
                      dataKey={`${baseKey}_fcst`}
                      name={`${region.regionName} (Fcst)`}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                      legendType="none" // avoid duplicate legend item
                    />
                  </>
                )
              })}
              <Legend />
              
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
              disabled={!xDomain}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Y</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleYZoomIn}
                className="h-8"
                disabled={yRange[1] - yRange[0] <= 0}
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleYZoomOut}
                className="h-8"
                disabled={!yDomain}
              >
                <ZoomOut className="h-4 w-4 mr-1" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetYZoom}
                className="h-8"
                disabled={!yDomain}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {xDomain ? `X: ${Math.round(xDomain[0])}-${Math.round(xDomain[1])}` : "X: all"} •{" "}
            {yDomain ? `Y: ${formatValue(yDomain[0], unit)}–${formatValue(yDomain[1], unit)}` : "Y: all"} • Drag brush to zoom X
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ChartTimeseriesCompare
export { ChartTimeseriesCompare }
