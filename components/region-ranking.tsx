"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchChoropleth, calculateChange } from "@/lib/data-service"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import type { RegionLevel } from "@/lib/map/region-layers"

interface RegionRankingProps {
  metricId: string
  region: string
  year: number
  scenario: Scenario
}

export function RegionRanking({ metricId, region, year, scenario }: RegionRankingProps) {
  const [rankData, setRankData] = useState<{
    valueRank: number
    valueTotal: number
    valuePercentile: number
    growthRank: number
    growthTotal: number
    growthPercentile: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    ;(async () => {
      try {
        const regionConfig = REGIONS.find((r) => r.code === region)
        const level = (regionConfig?.level as RegionLevel) || "ITL1"

        // Fetch current year data
        const choroplethData = await fetchChoropleth({
          metricId,
          level,
          year,
          scenario,
        })

        // Fetch past year data for growth calculation
        const pastYear = year - 1
        const choroplethDataPast = await fetchChoropleth({
          metricId,
          level,
          year: pastYear,
          scenario,
        })

        if (cancelled) return

        // Calculate value rank
        const regionsWithValues = Object.entries(choroplethData.values)
          .map(([code, value]) => ({
            code,
            value,
          }))
          .filter((r) => r.value != null && isFinite(r.value))
          .sort((a, b) => b.value - a.value)

        const selectedValueIndex = regionsWithValues.findIndex((r) => r.code === region)
        const valueRank = selectedValueIndex >= 0 ? selectedValueIndex + 1 : 0
        const valueTotal = regionsWithValues.length
        const valuePercentile =
          valueTotal > 0 ? Math.round(((valueTotal - valueRank) / valueTotal) * 100) : 0

        // Calculate growth rank (YoY growth)
        const regionsWithGrowth = Object.entries(choroplethData.values)
          .map(([code, currentValue]) => {
            const pastValue = choroplethDataPast.values[code]
            const growth =
              pastValue != null && pastValue > 0 && currentValue != null
                ? calculateChange(currentValue, pastValue)
                : null
            return {
              code,
              growth: growth ?? 0,
              hasValidGrowth: growth !== null,
            }
          })
          .filter((r) => r.hasValidGrowth)
          .sort((a, b) => b.growth - a.growth) // Higher growth = better rank

        const selectedGrowthIndex = regionsWithGrowth.findIndex((r) => r.code === region)
        const growthRank = selectedGrowthIndex >= 0 ? selectedGrowthIndex + 1 : 0
        const growthTotal = regionsWithGrowth.length
        const growthPercentile =
          growthTotal > 0 ? Math.round(((growthTotal - growthRank) / growthTotal) * 100) : 0

        if (!cancelled) {
          setRankData({
            valueRank,
            valueTotal,
            valuePercentile,
            growthRank,
            growthTotal,
            growthPercentile,
          })
        }
      } catch (error) {
        console.error("Failed to fetch ranking data:", error)
        if (!cancelled) {
          setRankData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [metricId, region, year, scenario])

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!rankData || rankData.growthTotal === 0) {
    return null
  }

  const getGrowthQuartileMessage = (percentile: number) => {
    if (percentile >= 75) {
      return "Top-quartile year-on-year growth compared to peers."
    } else if (percentile >= 50) {
      return "Above-median year-on-year growth compared to peers."
    } else if (percentile >= 25) {
      return "Below-median year-on-year growth compared to peers."
    } else {
      return "Bottom-quartile year-on-year growth compared to peers."
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Year-on-Year Growth Rank
            </div>
            <div className="text-lg font-semibold">
              Rank {rankData.growthRank} / {rankData.growthTotal} ({rankData.growthPercentile}th percentile)
            </div>
            <div className="text-sm text-muted-foreground">
              {getGrowthQuartileMessage(rankData.growthPercentile)}
            </div>
            <div className="text-xs text-muted-foreground/70 italic">
              Note: This ranks how fast this metric is changing, not its absolute level.
            </div>
          </div>

          {/* Visual Rank Strip */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Slowest growth</span>
              <span>Fastest growth</span>
            </div>
            {/* Progress bar background */}
            <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
              {/* Position indicator */}
              <div
                className="absolute top-0 h-3 rounded-full transition-all"
                style={{
                  left:
                    rankData.growthTotal > 1 && rankData.growthRank > 0
                      ? `${((rankData.growthTotal - rankData.growthRank) / (rankData.growthTotal - 1)) * 100}%`
                      : "0%",
                  width: `${Math.max((1 / rankData.growthTotal) * 100, 2)}%`,
                  // Color interpolation: red (low growth) to green (high growth)
                  backgroundColor:
                    rankData.growthTotal > 1 && rankData.growthRank > 0
                      ? (() => {
                          const position =
                            (rankData.growthTotal - rankData.growthRank) /
                            (rankData.growthTotal - 1)
                          const red = Math.round(255 * (1 - position))
                          const green = Math.round(255 * position)
                          return `rgb(${red}, ${green}, 0)`
                        })()
                      : "rgb(128, 128, 0)",
                }}
                title={`Growth rank: ${rankData.growthRank} of ${rankData.growthTotal}`}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

