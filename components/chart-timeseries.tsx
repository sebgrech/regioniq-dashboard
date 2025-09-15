"use client"

import { useMemo, useState, useCallback } from "react"
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
  ReferenceArea,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import type { Scenario } from "@/lib/metrics.config"
import { formatValue, type DataPoint } from "@/lib/data-service"

type ChartTimeseriesProps = {
  title: string
  description?: string
  data: DataPoint[] // baseline series
  additionalSeries?: {
    scenario: Scenario // "upside" | "downside"
    data: DataPoint[]
    color?: string
  }[]
  unit: string
  metricId: string
  isLoading?: boolean
  className?: string
}

type Row = {
  year: number
  type?: DataPoint["type"]
  // split fields
  baseline_hist?: number | null
  baseline_fcst?: number | null
  upside_hist?: number | null
  upside_fcst?: number | null
  downside_hist?: number | null
  downside_fcst?: number | null
  // unified (fallback) fields — if your data comes as single keys
  baseline?: number | null
  upside?: number | null
  downside?: number | null
}

const DEFAULT_COLORS: Record<"baseline" | "upside" | "downside", string> = {
  baseline: "#3b82f6",
  upside:   "#10b981",
  downside: "#ef4444",
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
  // zoom/pan
  const [xDomain, setXDomain] = useState<[number, number] | undefined>()
  const [selecting, setSelecting] = useState(false)
  const [selectStart, setSelectStart] = useState<number | undefined>()
  const [selectEnd, setSelectEnd] = useState<number | undefined>()

  const SCEN_COLORS = useMemo(() => {
    const up = additionalSeries.find(s => s.scenario === "upside")?.color ?? DEFAULT_COLORS.upside
    const down = additionalSeries.find(s => s.scenario === "downside")?.color ?? DEFAULT_COLORS.downside
    return { baseline: DEFAULT_COLORS.baseline, upside: up, downside: down }
  }, [additionalSeries])

  // Build rows tolerant to both split and unified shapes
  const rawRows: Row[] = useMemo(() => {
    const byYear = new Map<number, Row>()
    if (data?.length) {
      for (const pt of data) {
        const row = byYear.get(pt.year) ?? { year: pt.year }
        row.type = row.type ?? pt.type
        if (pt.type === "historical") row.baseline_hist = pt.value
        else                          row.baseline_fcst = pt.value
        // aggregate fallback
        row.baseline = pt.value
        byYear.set(pt.year, row)
      }
    }

    for (const s of additionalSeries) {
      const scen = s.scenario as "upside" | "downside"
      for (const pt of s.data) {
        const row = byYear.get(pt.year) ?? { year: pt.year }
        row.type = row.type ?? pt.type
        // accept both split and unified upstream shapes by always setting:
        // 1) split field for styling (if we later choose split)
        // 2) unified fallback field to guarantee a visible line
        if (pt.type === "historical") (row as any)[`${scen}_hist`] = pt.value
        else                          (row as any)[`${scen}_fcst`] = pt.value
        ;(row as any)[scen] = pt.value
        byYear.set(pt.year, row)
      }
    }

    return Array.from(byYear.values()).sort((a, b) => a.year - b.year)
  }, [data, additionalSeries])

  // Forecast start year (prefer baseline)
  const forecastStartYear = useMemo(() => {
    const b = data?.find(d => d.type === "forecast")?.year
    if (b != null) return b
    return rawRows.find(r => r.type === "forecast")?.year ?? null
  }, [data, rawRows])

  // Seam stitch for split keys so dashed forecast connects right at the boundary
  const chartData: Row[] = useMemo(() => {
    if (!rawRows.length || forecastStartYear == null) return rawRows
    const rows = rawRows.map(r => ({ ...r }))
    const at = rows.find(r => r.year === forecastStartYear)
    const prev = rows.find(r => r.year === forecastStartYear - 1)

    const stitch = (histKey: keyof Row, fcstKey: keyof Row) => {
      const join =
        (at as any)?.[histKey] ??
        (at as any)?.[fcstKey] ??
        (prev as any)?.[histKey] ??
        null
      if (join != null && at) {
        if ((at as any)[histKey] == null) (at as any)[histKey] = join
        if ((at as any)[fcstKey] == null) (at as any)[fcstKey] = join
      }
    }

    stitch("baseline_hist", "baseline_fcst")
    stitch("upside_hist", "upside_fcst")
    stitch("downside_hist", "downside_fcst")

    return rows
  }, [rawRows, forecastStartYear])

  // Presence flags (for both shapes)
  const hasUnifiedUpside   = useMemo(() => chartData.some(r => r.upside   != null), [chartData])
  const hasUnifiedDownside = useMemo(() => chartData.some(r => r.downside != null), [chartData])
  const hasSplitUpside     = useMemo(() => chartData.some(r => r.upside_hist   != null || r.upside_fcst   != null), [chartData])
  const hasSplitDownside   = useMemo(() => chartData.some(r => r.downside_hist != null || r.downside_fcst != null), [chartData])

  // Year & Y domains (include both unified + split fields so scaling is correct)
  const yearMinMax = useMemo(() => {
    if (!chartData.length) return { min: 0, max: 0 }
    const ys = chartData.map(r => r.year)
    return { min: Math.min(...ys), max: Math.max(...ys) }
  }, [chartData])

  const yDomain = useMemo(() => {
    const currentX = xDomain || [yearMinMax.min, yearMinMax.max]
    const visible = chartData.filter(d => d.year >= currentX[0] && d.year <= currentX[1])
    if (!visible.length) return ["auto", "auto"] as [string, string]

    const vals: number[] = []
    for (const r of visible) {
      const v = [
        r.baseline_hist, r.baseline_fcst, r.baseline,
        r.upside_hist,   r.upside_fcst,   r.upside,
        r.downside_hist, r.downside_fcst, r.downside,
      ].filter((n): n is number => n != null)
      vals.push(...v)
    }
    if (!vals.length) return ["auto", "auto"] as [string, string]
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.1
    return [min - pad, max + pad] as [number, number]
  }, [xDomain, yearMinMax, chartData])

  // Legend items (only those present)
  const legendItems = useMemo(() => {
    const items: { id: string; label: string; color: string }[] = [
      { id: "baseline", label: "Baseline", color: SCEN_COLORS.baseline },
    ]
    if (hasUnifiedUpside || hasSplitUpside) {
      items.push({ id: "upside", label: "Upside", color: SCEN_COLORS.upside })
    }
    if (hasUnifiedDownside || hasSplitDownside) {
      items.push({ id: "downside", label: "Downside", color: SCEN_COLORS.downside })
    }
    return items
  }, [hasUnifiedUpside, hasSplitUpside, hasUnifiedDownside, hasSplitDownside, SCEN_COLORS])

  // Tooltip (dedup hist/fcst entries)
  const labelFromKey = (k: string) =>
    k.replace(/_(hist|fcst)$/, "")
     .replace(/^baseline$/, "Baseline")
     .replace(/^upside$/, "Upside")
     .replace(/^downside$/, "Downside")

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const rowType = payload[0]?.payload?.type as DataPoint["type"] | undefined
    const preferFcst = rowType === "forecast"
    const ordered = preferFcst ? [...payload].reverse() : payload

    const seen = new Set<string>()
    const dedup: any[] = []
    for (const e of ordered) {
      const base = e.dataKey.replace(/_(hist|fcst)$/, "")
      if (!seen.has(base) && e.value != null) {
        dedup.push(e)
        seen.add(base)
      }
    }

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{Math.floor(label)}</span>
          <Badge variant={rowType === "historical" ? "secondary" : "outline"} className="text-xs">
            {rowType === "historical" ? "Historical" : "Forecast"}
          </Badge>
        </div>
        <div className="space-y-1">
          {dedup.map((e: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{labelFromKey(e.dataKey)}</span>
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

  const LegendContent = () => (
    <div className="pt-5 flex justify-center">
      <div className="flex items-center gap-6">
        {legendItems.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <span className="inline-block w-5 h-0.5" style={{ background: it.color }} />
            <span className="text-sm text-gray-700 dark:text-gray-300">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )

  // zoom handlers
  const handleMouseDown = useCallback((e: any) => {
    if (!e || e.activeLabel === undefined) return
    setSelecting(true)
    setSelectStart(e.activeLabel)
    setSelectEnd(e.activeLabel)
  }, [])

  const handleMouseMove = useCallback((e: any) => {
    if (!selecting || !e || e.activeLabel === undefined) return
    setSelectEnd(e.activeLabel)
  }, [selecting])

  const handleMouseUp = useCallback(() => {
    if (!selecting || selectStart === undefined || selectEnd === undefined) {
      setSelecting(false)
      setSelectStart(undefined)
      setSelectEnd(undefined)
      return
    }
    const xMin = Math.min(selectStart, selectEnd)
    const xMax = Math.max(selectStart, selectEnd)
    if (xMin !== xMax && xMax - xMin > 0.5) setXDomain([xMin, xMax])
    setSelecting(false)
    setSelectStart(undefined)
    setSelectEnd(undefined)
  }, [selecting, selectStart, selectEnd])

  const handleResetZoom = useCallback(() => {
    setXDomain(undefined)
    setSelecting(false)
    setSelectStart(undefined)
    setSelectEnd(undefined)
  }, [])

  const handleZoomIn = useCallback(() => {
    const current = xDomain || [yearMinMax.min, yearMinMax.max]
    const range = current[1] - current[0]
    const center = (current[0] + current[1]) / 2
    const newRange = Math.max(2, range * 0.7)
    const newXMin = Math.max(yearMinMax.min, center - newRange / 2)
    const newXMax = Math.min(yearMinMax.max, center + newRange / 2)
    setXDomain([newXMin, newXMax])
  }, [xDomain, yearMinMax])

  const handleZoomOut = useCallback(() => {
    if (!xDomain) return
    const range = xDomain[1] - xDomain[0]
    const center = (xDomain[0] + xDomain[1]) / 2
    const fullRange = yearMinMax.max - yearMinMax.min
    const newRange = Math.min(fullRange, range * 1.4)
    if (newRange >= fullRange * 0.95) {
      handleResetZoom()
    } else {
      const newXMin = Math.max(yearMinMax.min, center - newRange / 2)
      const newXMax = Math.min(yearMinMax.max, center + newRange / 2)
      setXDomain([newXMin, newXMax])
    }
  }, [xDomain, yearMinMax, handleResetZoom])

  const handlePanLeft = useCallback(() => {
    if (!xDomain) return
    const range = xDomain[1] - xDomain[0]
    const shift = range * 0.25
    const newXMin = Math.max(yearMinMax.min, xDomain[0] - shift)
    const newXMax = newXMin + range
    if (newXMax <= yearMinMax.max) setXDomain([newXMin, newXMax])
  }, [xDomain, yearMinMax])

  const handlePanRight = useCallback(() => {
    if (!xDomain) return
    const range = xDomain[1] - xDomain[0]
    const shift = range * 0.25
    const newXMax = Math.min(yearMinMax.max, xDomain[1] + shift)
    const newXMin = newXMax - range
    if (newXMin >= yearMinMax.min) setXDomain([newXMin, newXMax])
  }, [xDomain, yearMinMax])

  // Loading/empty
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

  const isZoomed = !!xDomain

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePanLeft} title="Pan left" disabled={!isZoomed}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePanRight} title="Pan right" disabled={!isZoomed}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} title="Zoom out" disabled={!isZoomed}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetZoom} title="Reset view" disabled={!isZoomed}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="outline" className="text-xs">
              {xDomain ? `${Math.floor(xDomain[0])}-${Math.floor(xDomain[1])}` : `${yearMinMax.min}-${yearMinMax.max}`}
            </Badge>
          </div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 36, right: 72, left: 20, bottom: 20 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
              <XAxis
                dataKey="year"
                type="number"
                domain={xDomain || ["dataMin", "dataMax"]}
                allowDataOverflow
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(v) => Math.floor(v).toString()}
              />
              <YAxis
                domain={yDomain}
                allowDataOverflow
                tick={{ fontSize: 12, fill: "#6b7280" }}
                tickLine={{ stroke: "#e5e7eb" }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(v) => formatValue(v, unit)}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Drag-to-zoom overlay */}
              {selecting && selectStart !== undefined && selectEnd !== undefined && (
                <ReferenceArea x1={selectStart} x2={selectEnd} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.1} />
              )}

              {/* Forecast marker */}
              {forecastStartYear != null && (
                <ReferenceLine x={forecastStartYear} stroke="#9ca3af" strokeDasharray="5 5" strokeOpacity={0.9}>
                  <Label value="Forecast" position="top" dx={40} dy={12} fill="#6b7280" fontSize={12} />
                </ReferenceLine>
              )}

              {/* Baseline (split) */}
              <Line
                type="monotone"
                dataKey="baseline_hist"
                name="Baseline"
                stroke={SCEN_COLORS.baseline}
                strokeWidth={2.5}
                strokeLinecap="round"
                isAnimationActive={false}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="baseline_fcst"
                stroke={SCEN_COLORS.baseline}
                strokeWidth={2.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
                isAnimationActive={false}
                dot={false}
                connectNulls
                legendType="none"
              />

              {/* —— SCENARIOS — render unified if present, else split */}
              {/* Upside */}
              {hasUnifiedUpside ? (
                <Line
                  type="monotone"
                  dataKey="upside"
                  name="Upside"
                  stroke={SCEN_COLORS.upside}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                  isAnimationActive={false}
                  dot={false}
                  connectNulls
                />
              ) : hasSplitUpside ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="upside_hist"
                    name="Upside"
                    stroke={SCEN_COLORS.upside}
                    strokeWidth={2}
                    strokeLinecap="round"
                    isAnimationActive={false}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="upside_fcst"
                    stroke={SCEN_COLORS.upside}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    isAnimationActive={false}
                    dot={false}
                    connectNulls
                    legendType="none"
                  />
                </>
              ) : null}

              {/* Downside */}
              {hasUnifiedDownside ? (
                <Line
                  type="monotone"
                  dataKey="downside"
                  name="Downside"
                  stroke={SCEN_COLORS.downside}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                  isAnimationActive={false}
                  dot={false}
                  connectNulls
                />
              ) : hasSplitDownside ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="downside_hist"
                    name="Downside"
                    stroke={SCEN_COLORS.downside}
                    strokeWidth={2}
                    strokeLinecap="round"
                    isAnimationActive={false}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="downside_fcst"
                    stroke={SCEN_COLORS.downside}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    isAnimationActive={false}
                    dot={false}
                    connectNulls
                    legendType="none"
                  />
                </>
              ) : null}

              <Legend content={<LegendContent />} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-600" />
              <span>Historical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gray-600 opacity-50" style={{ borderTop: "2px dashed" }} />
              <span>Forecast</span>
            </div>
          </div>
          <div className="text-xs">
            {isZoomed ? "Zoomed view • Click reset to see full range" : "Click and drag to zoom"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
