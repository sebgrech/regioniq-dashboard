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
  Label,
} from "recharts"
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
  isLoading?: boolean
  className?: string
}

const COLORS = {
  baseline: "#3b82f6", // blue
  upside: "#10b981",   // green
  downside: "#ef4444", // red
}

export function ChartTimeseries({
  title,
  description,
  data,
  additionalSeries = [],
  unit,
  isLoading = false,
  className,
}: ChartTimeseriesProps) {
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

  // Axis labels for header badge
  const yearMin = chartData[0]?.year
  const yearMax = chartData[chartData.length - 1]?.year

  // Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const rowType = payload[0]?.payload?.type
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
        <CardContent><Skeleton className="h-[400px] w-full" /></CardContent>
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
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 36, right: 72, left: 20, bottom: 20 }}>
              {/* Grid: visible in light, subtle in dark */}
              <CartesianGrid strokeDasharray="3 3" stroke="var(--riq-grid, #e5e7eb)" />

              <XAxis
                dataKey="year"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 12, fill: "var(--riq-axis, #6b7280)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--riq-axis, #6b7280)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Forecast divider on LAST historical year */}
              {markerYear != null && (
                <ReferenceLine x={markerYear} stroke="#9ca3af" strokeDasharray="5 5" strokeOpacity={0.9}>
                  <Label value="Forecast" position="top" dx={40} dy={12} fill="#6b7280" fontSize={12} />
                </ReferenceLine>
              )}

              {/* Baseline */}
              <Line
                type="monotone"
                dataKey="baseline"
                name="Baseline"
                stroke={COLORS.baseline}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              {/* Scenarios (dashed) */}
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

              <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Click and drag to zoom (solid = baseline, dashed = scenarios).
        </div>
      </CardContent>
    </Card>
  )
}
