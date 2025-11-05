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
  Legend,
} from "recharts"
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
        <div className="h-[400px] w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => formatValue(v, unit)} />
              <Tooltip
                formatter={(v: any) => formatValue(v, unit)}
                labelFormatter={(label) => `Year: ${label}`}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export default ChartTimeseriesCompare
export { ChartTimeseriesCompare }
