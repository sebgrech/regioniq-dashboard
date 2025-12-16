"use client"

import { useState, useMemo } from "react"
import { X, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { ExportableChartCard } from "@/components/exportable-chart-card"
import type { Metric } from "@/lib/metrics.config"
import { formatValue, formatPercentage, type DataPoint } from "@/lib/data-service"
import { cn } from "@/lib/utils"
import { scenarioLabel } from "@/lib/export/canonical"

interface MetricDrilldownProps {
  metric: Metric
  regionName: string
  year: number
  data: DataPoint[]
  ukData?: DataPoint[]
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
}

/** Calculate CAGR (Compound Annual Growth Rate) */
function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years === 0) return 0
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

/** Calculate YoY change */
function calculateYoY(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

export function MetricDrilldown({
  metric,
  regionName,
  year,
  data,
  ukData,
  isOpen,
  onClose,
  isLoading = false,
}: MetricDrilldownProps) {
  const [compareUK, setCompareUK] = useState(false)

  // Prepare chart data
  const chartData = useMemo(() => {
    const result = data.map((d) => ({
      year: d.year,
      value: d.value,
      ukValue: ukData?.find((uk) => uk.year === d.year)?.value || null,
    }))
    return result
  }, [data, ukData])

  const filenameBase = useMemo(() => {
    const safeRegion = (regionName || "region")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    return `regioniq_${metric.id}_${safeRegion}_drilldown`
  }, [metric.id, regionName])

  const exportRows = useMemo(() => {
    return (chartData ?? []).flatMap((r) => {
      const rows: Record<string, any>[] = []
      if (r.value != null) {
        rows.push({
          Metric: metric.title,
          Region: regionName,
          "Region Code": "",
          Year: r.year,
          Scenario: scenarioLabel("baseline"),
          Value: r.value,
          Units: metric.unit,
          "Data Type": "",
          Source: "",
        })
      }
      if (compareUK && ukData && r.ukValue != null) {
        rows.push({
          Metric: metric.title,
          Region: "UK Average",
          "Region Code": "UK",
          Year: r.year,
          Scenario: scenarioLabel("baseline"),
          Value: r.ukValue,
          Units: metric.unit,
          "Data Type": "",
          Source: "",
        })
      }
      return rows
    })
  }, [chartData, compareUK, metric.id, metric.title, metric.unit, regionName, ukData])

  const exportCsvRows = useMemo(
    () =>
      exportRows.map((r) => ({
        ...r,
        Value: typeof (r as any).Value === "number" ? Math.round((r as any).Value) : (r as any).Value,
      })),
    [exportRows],
  )

  // Calculate metrics
  const metrics = useMemo(() => {
    const currentYearData = data.find((d) => d.year === year)
    const previousYearData = data.find((d) => d.year === year - 1)
    const fiveYearsAgoData = data.find((d) => d.year === year - 5)
    const tenYearsAgoData = data.find((d) => d.year === year - 10)

    const currentValue = currentYearData?.value || 0
    const previousValue = previousYearData?.value || 0
    const fiveYearsAgoValue = fiveYearsAgoData?.value || 0
    const tenYearsAgoValue = tenYearsAgoData?.value || 0

    return {
      yoy: calculateYoY(currentValue, previousValue),
      cagr5y: calculateCAGR(fiveYearsAgoValue, currentValue, 5),
      cagr10y: calculateCAGR(tenYearsAgoValue, currentValue, 10),
    }
  }, [data, year])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ maxHeight: "80vh" }}
      >
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{metric.title}</h2>
              <p className="text-sm text-muted-foreground">
                {regionName} • {year}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            </div>
          ) : (
            <>
              {/* Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">YoY Change</div>
                  <div
                    className={cn(
                      "text-2xl font-bold flex items-center gap-2",
                      metrics.yoy >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {metrics.yoy >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPercentage(metrics.yoy)}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">5Y CAGR</div>
                  <div
                    className={cn(
                      "text-2xl font-bold flex items-center gap-2",
                      metrics.cagr5y >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {metrics.cagr5y >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPercentage(metrics.cagr5y)}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">10Y CAGR</div>
                  <div
                    className={cn(
                      "text-2xl font-bold flex items-center gap-2",
                      metrics.cagr10y >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {metrics.cagr10y >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    {formatPercentage(metrics.cagr10y)}
                  </div>
                </div>
              </div>

              {/* UK Comparison Toggle */}
              <div className="flex items-center gap-3 mb-4" data-riq-hide-on-export="true">
                <Switch
                  id="compare-uk"
                  checked={compareUK}
                  onCheckedChange={setCompareUK}
                />
                <Label htmlFor="compare-uk" className="cursor-pointer">
                  Compare vs UK Average
                </Label>
              </div>

              {/* Chart */}
              <ExportableChartCard
                rows={exportRows}
                csvRows={exportCsvRows}
                filenameBase={filenameBase}
                isLoading={isLoading}
                xlsxSheets={[
                  {
                    name: "data",
                    rows: exportRows,
                    columnFormats: { Year: "0", Value: "0" },
                  },
                ]}
              >
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-semibold mb-3">{metric.title} trend</div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => String(value)}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        if (metric.unit === "percentage") {
                          return `${value}%`
                        }
                        if (metric.unit === "currency") {
                          return value >= 1000 ? `${value / 1000}K` : String(value)
                        }
                        return String(value)
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatValue(value, metric.unit, metric.decimals)}
                      labelFormatter={(label) => `Year: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      name={regionName}
                    />
                    {compareUK && ukData && (
                      <Line
                        type="monotone"
                        dataKey="ukValue"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="UK Average"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
                </div>
              </ExportableChartCard>
            </>
          )}
        </div>
      </div>
    </>
  )
}

