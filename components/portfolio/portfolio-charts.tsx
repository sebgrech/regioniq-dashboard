"use client"

/**
 * Cross-location charts: indexed line chart + absolute bar chart.
 * Recycled from v1 with fixes: no duplicate region name in legend.
 */

import { useCallback, useMemo } from "react"
import { useTheme } from "next-themes"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import type { PortfolioAssetItem, MetricConfig } from "./portfolio-types"
import { ASSET_COLORS, METRICS, formatAbsoluteValue } from "./portfolio-types"
import { cn } from "@/lib/utils"

interface PortfolioChartsProps {
  assets: PortfolioAssetItem[]
  visibleAssets: PortfolioAssetItem[]
  visible: boolean[]
  selectedMetric: string
  setSelectedMetric: (id: string) => void
  selectedMetricConfig: MetricConfig
  chartData: Record<string, any>[]
  yDomain: [number, number]
  barData: { name: string; value: number; color: string }[]
  baseYear: number
  forecastStartYear: number
  isLoading: boolean
  hoveredAssetIndex: number | null
}

export function PortfolioCharts({
  assets,
  visibleAssets,
  visible,
  selectedMetric,
  setSelectedMetric,
  selectedMetricConfig,
  chartData,
  yDomain,
  barData,
  baseYear,
  forecastStartYear,
  isLoading,
  hoveredAssetIndex,
}: PortfolioChartsProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  const textColor = isDarkMode ? "#9ca3af" : "#6b7280"

  const barHeight = Math.max(120, barData.length * 32 + 40)

  // ---- Adaptive scaling tiers ----
  const isHighScale = visibleAssets.length >= 10
  const isMidScale = visibleAssets.length >= 5
  const restingOpacity = isHighScale ? 0.35 : 1

  // At 10+, auto-detect top and bottom performers by latest indexed value
  const { topIdx, bottomIdx, topYear, topValue, bottomValue } = useMemo(() => {
    if (!isHighScale || chartData.length === 0) {
      return { topIdx: -1, bottomIdx: -1, topYear: 0, topValue: 0, bottomValue: 0 }
    }
    const lastRow = chartData[chartData.length - 1]
    const latestYear = lastRow?.year ?? 0
    let best = -Infinity, worst = Infinity
    let bestIdx = -1, worstIdx = -1
    let bestVal = 0, worstVal = 0

    visibleAssets.forEach((a) => {
      const idx = assets.indexOf(a)
      const val = (lastRow[`a${idx}_fcst`] ?? lastRow[`a${idx}_hist`]) as number | undefined
      if (val == null) return
      if (val > best) { best = val; bestIdx = idx; bestVal = val }
      if (val < worst) { worst = val; worstIdx = idx; worstVal = val }
    })
    return { topIdx: bestIdx, bottomIdx: worstIdx, topYear: latestYear, topValue: bestVal, bottomValue: worstVal }
  }, [isHighScale, chartData, visibleAssets, assets])

  // ---- Tooltips ----
  const LineTooltip = useCallback(
    ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null
      const isForecast = label > forecastStartYear
      const uniqueEntries = new Map<
        string,
        { name: string; value: number; color: string }
      >()
      payload.forEach((entry: any) => {
        if (entry.value == null) return
        const idxMatch = entry.dataKey.match(/^a(\d+)/)
        if (!idxMatch) return
        const idx = parseInt(idxMatch[1], 10)
        const name = assets[idx]?.region_name ?? "Location"
        if (!uniqueEntries.has(name)) {
          uniqueEntries.set(name, {
            name,
            value: entry.value,
            color: ASSET_COLORS[idx % ASSET_COLORS.length],
          })
        }
      })
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
          <p className="font-semibold text-foreground mb-1">
            {label}{" "}
            {isForecast && (
              <span className="text-muted-foreground font-normal">
                (forecast)
              </span>
            )}
          </p>
          {Array.from(uniqueEntries.values()).map((entry, i) => (
            <p key={i} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
            </p>
          ))}
        </div>
      )
    },
    [assets, forecastStartYear]
  )

  const BarTooltip = useCallback(
    ({ active, payload }: any) => {
      if (!active || !payload?.length) return null
      const data = payload[0]?.payload
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
          <p className="font-semibold text-foreground mb-1">{data?.name}</p>
          <p style={{ color: data?.color }}>
            {selectedMetricConfig.label}:{" "}
            {formatAbsoluteValue(data?.value, selectedMetricConfig.unit)}
          </p>
          <p className="text-muted-foreground mt-1">As of {baseYear}</p>
        </div>
      )
    },
    [selectedMetricConfig, baseYear]
  )

  return (
    <div className="space-y-5">
      {/* Section header + metric toggle (inline) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Cross-Location Comparison
          </h3>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Indexed from {baseYear} = 100
          </p>
        </div>

        {/* Metric toggle — pill-style, Apple-like segmented control */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/40">
          {METRICS.map((metric) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                selectedMetric === metric.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4 p-5 rounded-2xl bg-card/40 border border-border/30">
          <div className="h-4 w-28 skeleton-shimmer rounded" />
          <div className="h-[280px] w-full skeleton-shimmer rounded" />
          <div className="flex gap-4">
            <div className="h-2 w-20 skeleton-shimmer rounded" />
            <div className="h-2 w-16 skeleton-shimmer rounded" />
          </div>
        </div>
      )}

      {/* Charts */}
      {!isLoading && chartData.length > 0 && (
        <div className="space-y-6 p-5 rounded-2xl bg-card/40 border border-border/30">
          {/* Line chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {selectedMetricConfig.label}{" "}
                <span className="font-normal">
                  (indexed to {baseYear} = 100)
                </span>
              </span>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: isHighScale ? 90 : 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 10, fill: textColor }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={{ stroke: gridStroke }}
                  />
                  <YAxis
                    domain={yDomain}
                    tick={{ fontSize: 10, fill: textColor }}
                    axisLine={{ stroke: gridStroke }}
                    tickLine={{ stroke: gridStroke }}
                    width={35}
                  />
                  <RechartsTooltip content={<LineTooltip />} />
                  <ReferenceLine
                    y={100}
                    stroke={gridStroke}
                    strokeDasharray="2 2"
                  />
                  <ReferenceLine
                    x={forecastStartYear}
                    stroke={textColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{
                      value: "Forecast",
                      position: "insideTopLeft",
                      fontSize: 9,
                      fill: textColor,
                      opacity: 0.7,
                      dx: 4,
                    }}
                  />
                  {visibleAssets.map((a) => {
                    const idx = assets.indexOf(a)
                    const color = ASSET_COLORS[idx % ASSET_COLORS.length]

                    // Adaptive opacity based on tier and hover state
                    const isHovered = hoveredAssetIndex === idx
                    const isAutoHighlighted = isHighScale && (idx === topIdx || idx === bottomIdx)
                    const lineOpacity = isMidScale
                      ? hoveredAssetIndex != null
                        ? (isHovered ? 1 : 0.15)
                        : (isAutoHighlighted ? 1 : restingOpacity)
                      : 1
                    const lineWidth = isMidScale
                      ? (isHovered ? 3 : (isAutoHighlighted && hoveredAssetIndex == null ? 2.5 : 2))
                      : 2.5

                    return [
                      <Line
                        key={`a${idx}_hist`}
                        type="monotone"
                        dataKey={`a${idx}_hist`}
                        name={a.region_name}
                        stroke={color}
                        strokeWidth={lineWidth}
                        strokeOpacity={lineOpacity}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                        style={{ transition: "stroke-opacity 200ms ease, stroke-width 200ms ease" }}
                      />,
                      <Line
                        key={`a${idx}_fcst`}
                        type="monotone"
                        dataKey={`a${idx}_fcst`}
                        name={`${a.region_name} (F)`}
                        stroke={color}
                        strokeWidth={lineWidth}
                        strokeOpacity={lineOpacity}
                        dot={false}
                        strokeDasharray="5 3"
                        activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                        style={{ transition: "stroke-opacity 200ms ease, stroke-width 200ms ease" }}
                      />,
                    ]
                  })}

                  {/* Auto-highlight labels for top/bottom at 10+ (resting state only) */}
                  {isHighScale && hoveredAssetIndex == null && topIdx >= 0 && bottomIdx >= 0 && topIdx !== bottomIdx && (
                    <>
                      <ReferenceDot
                        key="top-label"
                        x={topYear}
                        y={topValue}
                        r={0}
                        label={{
                          value: `▲ ${assets[topIdx]?.region_name}`,
                          position: "right",
                          fontSize: 9,
                          fontWeight: 600,
                          fill: ASSET_COLORS[topIdx % ASSET_COLORS.length],
                          dx: 4,
                        }}
                      />
                      <ReferenceDot
                        key="bottom-label"
                        x={topYear}
                        y={bottomValue}
                        r={0}
                        label={{
                          value: `▼ ${assets[bottomIdx]?.region_name}`,
                          position: "right",
                          fontSize: 9,
                          fontWeight: 600,
                          fill: ASSET_COLORS[bottomIdx % ASSET_COLORS.length],
                          dx: 4,
                        }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend — fixed: no duplicate region name */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] px-1 mt-3">
              {visibleAssets.map((a) => {
                const idx = assets.indexOf(a)
                const color = ASSET_COLORS[idx % ASSET_COLORS.length]
                return (
                  <span key={a.id} className="flex items-center gap-2">
                    <span
                      className="w-4 h-1 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-foreground font-medium">
                      {a.region_name}
                    </span>
                  </span>
                )
              })}
              <span className="flex items-center gap-1.5 ml-auto text-muted-foreground/70">
                <span className="w-3 border-t border-dashed border-muted-foreground" />
                <span>forecast</span>
              </span>
            </div>
          </div>

          {/* Bar chart */}
          {barData.length > 0 && (
            <div className="pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {baseYear} {selectedMetricConfig.label} Comparison
                </span>
              </div>
              <div style={{ height: barHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStroke}
                      opacity={0.3}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                      tickFormatter={(v) =>
                        formatAbsoluteValue(v, selectedMetricConfig.unit)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 9, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                      width={180}
                    />
                    <RechartsTooltip
                      content={<BarTooltip />}
                      cursor={{
                        fill: isDarkMode
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.05)",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {barData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={0.9}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && chartData.length === 0 && (
        <div className="p-6 rounded-2xl bg-muted/20 border border-border/20 text-center">
          <p className="text-sm text-muted-foreground">
            No data available. Select at least one asset above.
          </p>
        </div>
      )}
    </div>
  )
}
