"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DataRow {
  Metric: string
  Region: string
  "Region Code": string
  Year: number
  Scenario: string
  Value: number | null
  Units: string
  "Data Type": string
  Source: string
}

interface PivotTableProps {
  data: DataRow[]
  unit?: string
}

interface PivotRow {
  metric: string
  region: string
  regionCode: string
  scenario: string
  values: Record<number, number | null>
  dataTypes: Record<number, string>  // Track data type per year (historical/forecast)
  units: string
  trend: "up" | "down" | "flat"
}

function formatCompact(raw: number | null, unit: string, metricName?: string): string {
  if (raw == null) return "—"
  
  // Detect if unit indicates value is already in millions (£m, mn_gbp, etc.)
  const unitLower = unit?.toLowerCase() ?? ""
  const metricLower = metricName?.toLowerCase() ?? ""
  
  // Check both unit and metric name for millions indicators
  const isMillions = unitLower.includes("mn") || 
                     unitLower === "£m" || 
                     unitLower === "m" ||
                     unitLower.includes("_mn_") ||
                     unitLower.includes("million") ||
                     // Also check metric name for GVA (always stored in millions)
                     metricLower.includes("gross value added") ||
                     metricLower.includes("gva")
  
  // Detect if unit is GBP-based
  const isGBP = unit && (unitLower.includes("gbp") || unit.includes("£")) ||
                metricLower.includes("gva") || metricLower.includes("gross value added")
  const prefix = isGBP ? "£" : ""
  
  // If value is already in millions, convert to actual value for proper scaling
  const actualValue = isMillions ? raw * 1_000_000 : raw
  
  // Format with appropriate suffix
  if (Math.abs(actualValue) >= 1_000_000_000_000) {
    return `${prefix}${(actualValue / 1_000_000_000_000).toFixed(1)}T`
  }
  if (Math.abs(actualValue) >= 1_000_000_000) {
    return `${prefix}${(actualValue / 1_000_000_000).toFixed(1)}bn`
  }
  if (Math.abs(actualValue) >= 1_000_000) {
    return `${prefix}${(actualValue / 1_000_000).toFixed(1)}m`
  }
  if (Math.abs(actualValue) >= 1_000) {
    return `${prefix}${(actualValue / 1_000).toFixed(1)}K`
  }
  
  // For percentages, show with decimal
  if (unit && unit.includes("%")) {
    return `${raw.toFixed(1)}%`
  }
  
  return `${prefix}${Math.round(raw).toLocaleString()}`
}

function MiniSparkline({ values, trend }: { values: (number | null)[]; trend: "up" | "down" | "flat" }) {
  const validValues = values.filter((v): v is number => v !== null)
  if (validValues.length < 2) return null

  const min = Math.min(...validValues)
  const max = Math.max(...validValues)
  const range = max - min || 1

  const points = validValues.map((v, i) => {
    const x = (i / (validValues.length - 1)) * 40
    const y = 12 - ((v - min) / range) * 10
    return `${x},${y}`
  }).join(" ")

  const color = trend === "up"
    ? "text-green-500"
    : trend === "down"
    ? "text-orange-500"
    : "text-muted-foreground"

  return (
    <svg width="40" height="14" className={cn("shrink-0", color)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PivotTable({ data, unit = "" }: PivotTableProps) {
  // Extract unique years and sort them
  const years = useMemo(() => {
    const yearSet = new Set(data.map((d) => d.Year))
    return Array.from(yearSet).sort((a, b) => a - b)
  }, [data])

  // Pivot the data: group by metric + region + scenario
  const pivotedData = useMemo(() => {
    const groups = new Map<string, PivotRow>()

    for (const row of data) {
      const key = `${row.Metric}|${row["Region Code"]}|${row.Scenario}`

      if (!groups.has(key)) {
        groups.set(key, {
          metric: row.Metric,
          region: row.Region,
          regionCode: row["Region Code"],
          scenario: row.Scenario,
          values: {},
          dataTypes: {},
          units: row.Units || unit,
          trend: "flat",
        })
      }

      const group = groups.get(key)!
      group.values[row.Year] = row.Value
      group.dataTypes[row.Year] = row["Data Type"] || ""
    }

    // Calculate trend for each row
    for (const row of groups.values()) {
      const sortedYears = Object.keys(row.values)
        .map(Number)
        .sort((a, b) => a - b)

      if (sortedYears.length >= 2) {
        const firstVal = row.values[sortedYears[0]]
        const lastVal = row.values[sortedYears[sortedYears.length - 1]]

        if (firstVal !== null && lastVal !== null) {
          const change = ((lastVal - firstVal) / Math.abs(firstVal || 1)) * 100
          row.trend = change > 1 ? "up" : change < -1 ? "down" : "flat"
        }
      }
    }

    // Sort: by metric, then region, then scenario
    return Array.from(groups.values()).sort((a, b) => {
      if (a.metric !== b.metric) return a.metric.localeCompare(b.metric)
      if (a.region !== b.region) return a.region.localeCompare(b.region)
      // Scenario order: Baseline, Upside, Downside
      const scenarioOrder = { Baseline: 0, Upside: 1, Downside: 2 }
      return (scenarioOrder[a.scenario as keyof typeof scenarioOrder] ?? 3) -
             (scenarioOrder[b.scenario as keyof typeof scenarioOrder] ?? 3)
    })
  }, [data, unit])

  // Group rows by metric + region for visual grouping
  const groupedRows = useMemo(() => {
    const groups: { key: string; metric: string; region: string; regionCode: string; rows: PivotRow[] }[] = []
    let currentGroup: typeof groups[0] | null = null

    for (const row of pivotedData) {
      const groupKey = `${row.metric}|${row.regionCode}`

      if (!currentGroup || currentGroup.key !== groupKey) {
        currentGroup = {
          key: groupKey,
          metric: row.metric,
          region: row.region,
          regionCode: row.regionCode,
          rows: [],
        }
        groups.push(currentGroup)
      }

      currentGroup.rows.push(row)
    }

    return groups
  }, [pivotedData])

  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <div className="text-muted-foreground">
          <p className="text-sm">No data to display</p>
          <p className="text-xs mt-1">Select metrics, regions, and years to query data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b">
              <th className="text-left p-3 font-medium sticky left-0 bg-muted/30 z-10 min-w-[180px]">
                Region
              </th>
              <th className="text-left p-3 font-medium min-w-[80px]">
                Scenario
              </th>
              {years.map((year) => (
                <th
                  key={year}
                  className="text-right p-3 font-medium font-mono tabular-nums min-w-[70px]"
                >
                  {year}
                </th>
              ))}
              <th className="text-center p-3 font-medium w-[50px]">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group, groupIdx) => (
              group.rows.map((row, rowIdx) => {
                const isFirstInGroup = rowIdx === 0
                const isLastInGroup = rowIdx === group.rows.length - 1
                const sparklineValues = years.map((y) => row.values[y])

                return (
                  <tr
                    key={`${row.regionCode}-${row.scenario}`}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/20",
                      isLastInGroup && groupIdx < groupedRows.length - 1 && "border-b-2",
                      !isFirstInGroup && "bg-muted/5"
                    )}
                  >
                    {/* Region - only show on first row of group */}
                    <td className="p-3 sticky left-0 bg-background z-10">
                      {isFirstInGroup ? (
                        <div className="space-y-0.5">
                          <div className="font-medium truncate max-w-[160px]">{row.region}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[9px] px-1">
                              {row.regionCode}
                            </Badge>
                            {group.rows.length === 1 && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                {row.metric}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">↳</span>
                      )}
                    </td>

                    {/* Scenario */}
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          row.scenario === "Baseline" && "border-blue-500/30 text-blue-600 dark:text-blue-400",
                          row.scenario === "Upside" && "border-green-500/30 text-green-600 dark:text-green-400",
                          row.scenario === "Downside" && "border-orange-500/30 text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {row.scenario}
                      </Badge>
                    </td>

                    {/* Year values */}
                    {years.map((year) => {
                      // Use actual data type per cell, not a hardcoded year
                      const dataType = row.dataTypes[year] || ""
                      const isForecast = dataType.toLowerCase() === "forecast"
                      return (
                        <td
                          key={year}
                          className={cn(
                            "p-3 text-right font-mono tabular-nums text-[13px]",
                            isForecast 
                              ? "text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/10" 
                              : "text-slate-900 dark:text-slate-100"
                          )}
                        >
                          {formatCompact(row.values[year], row.units, row.metric)}
                        </td>
                      )
                    })}

                    {/* Sparkline */}
                    <td className="p-3 text-center">
                      <MiniSparkline values={sparklineValues} trend={row.trend} />
                    </td>
                  </tr>
                )
              })
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with row count and legend */}
      <div className="border-t p-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
        <div className="flex items-center gap-4">
          <span>
            {pivotedData.length} row{pivotedData.length !== 1 ? "s" : ""} × {years.length} year{years.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3 border-l pl-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
              <span>Historical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800" />
              <span className="text-indigo-600 dark:text-indigo-400">Forecast</span>
            </div>
          </div>
        </div>
        <span className="font-mono">
          {years[0]}–{years[years.length - 1]}
        </span>
      </div>
    </div>
  )
}
