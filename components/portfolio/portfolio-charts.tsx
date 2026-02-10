"use client"

/**
 * Cross-location charts: indexed line chart + absolute bar chart.
 * Recycled from v1 with fixes: no duplicate region name in legend.
 */

import { useCallback } from "react"
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
}: PortfolioChartsProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  const textColor = isDarkMode ? "#9ca3af" : "#6b7280"

  const barHeight = Math.max(120, barData.length * 32 + 40)

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
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Cross-Location Comparison
          </h3>
          <p className="text-sm text-muted-foreground">
            All locations indexed from {baseYear} = 100
          </p>
        </div>
      </div>

      {/* Metric toggle */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              selectedMetric === metric.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
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
        <div className="space-y-6 p-5 rounded-xl bg-card/50 border border-border/30">
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
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
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
                    return [
                      <Line
                        key={`a${idx}_hist`}
                        type="monotone"
                        dataKey={`a${idx}_hist`}
                        name={a.region_name}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                      />,
                      <Line
                        key={`a${idx}_fcst`}
                        type="monotone"
                        dataKey={`a${idx}_fcst`}
                        name={`${a.region_name} (F)`}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        strokeDasharray="5 3"
                        activeDot={{ r: 3, strokeWidth: 2, fill: color }}
                      />,
                    ]
                  })}
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
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 text-center">
          <p className="text-sm text-muted-foreground">
            No data available. Select at least one asset above.
          </p>
        </div>
      )}
    </div>
  )
}
