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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatValue } from "@/lib/data-service"

// Define the component with a default export
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
  // Combine all regional data
  const chartData = useMemo(() => {
    if (!regions || regions.length === 0) return []

    const yearMap = new Map<number, any>()
    
    // Get all unique years
    regions.forEach(({ data }) => {
      data?.forEach((point: any) => {
        if (!yearMap.has(point.year)) {
          yearMap.set(point.year, { year: point.year })
        }
      })
    })

    // Add data for each region
    regions.forEach(({ regionName, data }, index) => {
      const dataKey = `region${index}`
      data?.forEach((point: any) => {
        const existing = yearMap.get(point.year)
        if (existing) {
          existing[dataKey] = point.value
          existing[`${dataKey}_name`] = regionName
        }
      })
    })

    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [regions])

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center">
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground">
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => formatValue(value, unit)} />
              <Tooltip 
                formatter={(value: any) => formatValue(value, unit)}
                labelFormatter={(label) => `Year: ${label}`}
              />
              
              {regions.map((region, index) => (
                <Line
                  key={`region${index}`}
                  type="monotone"
                  dataKey={`region${index}`}
                  name={region.regionName}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
              
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// IMPORTANT: Export both as default and named export
export default ChartTimeseriesCompare
export { ChartTimeseriesCompare }