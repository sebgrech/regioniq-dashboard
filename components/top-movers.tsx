"use client"

import { useMemo, useEffect, useState } from "react"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"
import { formatValue, formatPercentage, calculateChange, fetchSeries, type DataPoint } from "@/lib/data-service"
import { TrendingUp, TrendingDown, Briefcase, PoundSterling, DollarSign, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

interface TopMoversProps {
  year: number
  scenario: Scenario
  isLoading?: boolean
}

interface MoverItem {
  regionCode: string
  regionName: string
  value: number
  yoyChange: number
  sparklineData: number[]
  rank: number
}

interface MoversData {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: MoverItem[]
  metricId: string
  sortDirection: "asc" | "desc"
}

// Mini sparkline component
function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    return <div className="h-8 w-16 bg-muted/20 rounded" />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const width = 80
  const height = 24

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const pathData = `M ${points.join(" L ")}`

  return (
    <div className="h-8 w-16">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <path
          d={pathData}
          fill="none"
          className="stroke-foreground/60"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={points[points.length - 1]?.split(",")[0]}
          cy={points[points.length - 1]?.split(",")[1]}
          r="2"
          className="fill-foreground/80"
        />
      </svg>
    </div>
  )
}

function calculateMovers(
  metricId: string,
  allRegionsData: Record<string, DataPoint[]>,
  year: number,
  sortDirection: "asc" | "desc",
  level: RegionLevel
): MoverItem[] {
  // Get all regions for the selected level
  const regions = REGIONS.filter((r) => r.level === level)

  // Calculate movers for each region
  const movers: MoverItem[] = regions
    .map((region) => {
      const regionData = allRegionsData[region.code]
      if (!regionData || regionData.length === 0) return null

      const currentYearData = regionData.find((d) => d.year === year)
      const previousYearData = regionData.find((d) => d.year === year - 1)

      if (!currentYearData || !previousYearData) return null

      const value = currentYearData.value
      const yoyChange = calculateChange(value, previousYearData.value)

      // Get last 10 years of data for sparkline
      const sparklineData = regionData
        .filter((d) => d.year >= year - 9 && d.year <= year)
        .sort((a, b) => a.year - b.year)
        .map((d) => d.value)

      return {
        regionCode: region.code,
        regionName: region.name,
        value,
        yoyChange,
        sparklineData,
        rank: 0, // Will be set after sorting
      }
    })
    .filter((m): m is MoverItem => m !== null)
    .sort((a, b) => {
      if (sortDirection === "desc") {
        return b.yoyChange - a.yoyChange
      }
      return a.yoyChange - b.yoyChange
    })
    .slice(0, 5)
    .map((mover, index) => ({
      ...mover,
      rank: index + 1,
    }))

  return movers
}

export function TopMovers({ year, scenario, isLoading: externalLoading }: TopMoversProps) {
  const [allRegionsData, setAllRegionsData] = useState<Record<string, Record<string, DataPoint[]>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [level, setLevel] = useState<RegionLevel>("ITL1")

  const levels: RegionLevel[] = ["ITL1", "ITL2", "ITL3", "LAD"]

  // Fetch data for all regions at the selected level for each metric
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const regions = REGIONS.filter((r) => r.level === level)
        const metrics = ["emp_total_jobs", "nominal_gva_mn_gbp", "gdhi_per_head_gbp", "population_total"]

        const dataPromises = metrics.flatMap((metricId) =>
          regions.map(async (region) => {
            const data = await fetchSeries({ metricId, region: region.code, scenario })
            return { metricId, regionCode: region.code, data }
          })
        )

        const results = await Promise.all(dataPromises)

        // Organize data by metric and region
        const organized: Record<string, Record<string, DataPoint[]>> = {}
        results.forEach(({ metricId, regionCode, data }) => {
          if (!organized[metricId]) {
            organized[metricId] = {}
          }
          organized[metricId][regionCode] = data
        })

        setAllRegionsData(organized)
      } catch (error) {
        console.error("Failed to load movers data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [scenario, level])

  const moversData = useMemo(() => {
    if (isLoading || externalLoading || Object.keys(allRegionsData).length === 0) return []

    const movers: MoversData[] = [
      {
        title: "Fastest Job Growth",
        icon: Briefcase,
        metricId: "emp_total_jobs",
        sortDirection: "desc",
        items: calculateMovers("emp_total_jobs", allRegionsData["emp_total_jobs"] || {}, year, "desc", level),
      },
      {
        title: "Largest GVA Draggers",
        icon: PoundSterling,
        metricId: "nominal_gva_mn_gbp",
        sortDirection: "asc",
        items: calculateMovers("nominal_gva_mn_gbp", allRegionsData["nominal_gva_mn_gbp"] || {}, year, "asc", level),
      },
      {
        title: "Highest GDHI/head",
        icon: DollarSign,
        metricId: "gdhi_per_head_gbp",
        sortDirection: "desc",
        items: calculateMovers("gdhi_per_head_gbp", allRegionsData["gdhi_per_head_gbp"] || {}, year, "desc", level),
      },
      {
        title: "Fastest Population Growth",
        icon: Users,
        metricId: "population_total",
        sortDirection: "desc",
        items: calculateMovers("population_total", allRegionsData["population_total"] || {}, year, "desc", level),
      },
    ]

    return movers
  }, [allRegionsData, year, isLoading, externalLoading, level])

  if (isLoading || externalLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Top 5 Movers</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Regional performance leaders across key economic indicators
          </p>
        </div>
        {/* Granularity Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Granularity:</span>
          <div className="flex rounded-lg border border-border/50 p-0.5 bg-muted/30">
            {levels.map((l) => (
              <Button
                key={l}
                variant={level === l ? "default" : "ghost"}
                size="sm"
                onClick={() => setLevel(l)}
                className={cn(
                  "text-xs h-7 px-3",
                  level === l
                    ? "bg-background shadow-sm"
                    : "bg-transparent hover:bg-background/50"
                )}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {moversData.map((moverGroup) => {
          const Icon = moverGroup.icon
          const metric = METRICS.find((m) => m.id === moverGroup.metricId)

          return (
            <Card
              key={moverGroup.title}
              className="bg-card/80 backdrop-blur-sm border border-white/5 dark:border-white/10"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {moverGroup.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {moverGroup.items.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No data available
                    </div>
                  ) : (
                    moverGroup.items.map((item) => (
                      <div
                        key={item.regionCode}
                        className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-6 text-xs font-medium text-muted-foreground">
                            {item.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.regionName}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatValue(item.value, metric?.unit || "", metric?.decimals || 0)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <MiniSparkline data={item.sparklineData} />
                          <div
                            className={cn(
                              "text-xs font-semibold whitespace-nowrap",
                              item.yoyChange >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            {item.yoyChange >= 0 ? (
                              <TrendingUp className="h-3 w-3 inline mr-0.5" />
                            ) : (
                              <TrendingDown className="h-3 w-3 inline mr-0.5" />
                            )}
                            {formatPercentage(item.yoyChange)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

