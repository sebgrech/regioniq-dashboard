"use client"

import { useMemo } from "react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { YEARS, type Scenario } from "@/lib/metrics.config"
import { formatValue } from "@/lib/data-service"
import type { DataPoint } from "@/lib/data-service"

interface ChartTimeseriesProps {
  title: string
  description?: string
  data: DataPoint[]
  additionalSeries?: {
    scenario: Scenario
    data: DataPoint[]
    color?: string
  }[]
  unit: string
  metricId: string
  isLoading?: boolean
  className?: string
}

export function ChartTimeseries({
  title,
  description,
  data,
  additionalSeries = [],
  unit,
  metricId,
  isLoading = false,
  className,
}: ChartTimeseriesProps) {
  // Combine all data series for the chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Create a map of years to values for each series
    const yearMap = new Map<number, any>()

    // Add main series (baseline)
    data.forEach((point) => {
      yearMap.set(point.year, {
        year: point.year,
        baseline: point.value,
        type: point.type,
      })
    })

    // Add additional series (upside/downside)
    additionalSeries.forEach(({ scenario, data: seriesData }) => {
      seriesData.forEach((point) => {
        const existing = yearMap.get(point.year) || { year: point.year, type: point.type }
        existing[scenario] = point.value
        yearMap.set(point.year, existing)
      })
    })

    const result = Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
    
    // Debug logging
    console.log("ChartTimeseries data:", {
      firstRow: result[0],
      lastRow: result[result.length - 1],
      totalRows: result.length,
      hasUpside: result.some(r => r.upside !== undefined),
      hasDownside: result.some(r => r.downside !== undefined)
    })
    
    return result
  }, [data, additionalSeries])

  // Find where forecast starts - the first year that has type "forecast"
  const forecastStartYear = useMemo(() => {
    if (!chartData || chartData.length === 0) return null
    
    const firstForecastPoint = chartData.find(point => point.type === "forecast")
    return firstForecastPoint ? firstForecastPoint.year : null
  }, [chartData])

  // Custom tooltip
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
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{entry.dataKey}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatValue(entry.value, unit)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  // Check if we have data
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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title} (UPDATED - NO DASHED LINE)</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {YEARS.min}-{YEARS.max}
            </Badge>
          </div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <div className="h-[400px] w-full" data-chart-version="no-reference-line-v2">
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
                domain={['dataMin', 'dataMax']}  // Explicitly set domain
                allowDataOverflow={false}  // Prevent overflow that might cause extra lines
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(value) => formatValue(value, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Vertical line at forecast start */}
              <ReferenceLine
                x={YEARS.forecastStart}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                strokeOpacity={0.8}
                label={{ value: "Forecast", position: "top", fill: "#6b7280", fontSize: 12 }}
              />

              {/* Main baseline line */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 2, fill: "#fff" }}
                connectNulls={false}
                name="Baseline"
              />

              {/* Upside line - explicitly defined */}
              <Line
                type="monotone"
                dataKey="upside"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }}
                connectNulls={false}
                name="Upside"
              />

              {/* Downside line - explicitly defined */}
              <Line
                type="monotone"
                dataKey="downside"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                activeDot={{ r: 4, stroke: "#ef4444", strokeWidth: 2, fill: "#fff" }}
                connectNulls={false}
                name="Downside"
              />

              {/* Legend */}
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="line"
                formatter={(value) => <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart footer with additional info */}
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