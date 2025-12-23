"use client"

import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"
import { formatValue, formatPercentage, calculateChange, type DataPoint, fetchChoropleth } from "@/lib/data-service"
import { MapScaffold } from "@/components/map-scaffold"
import { TrendingUp, TrendingDown, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { PoliticalSummary } from "@/components/political-summary"
import { getGrowthMapType, getMapColorForValue, type MapType, DIVERGING_GROWTH_METRICS } from "@/lib/map-color-scale"

import type { RegionMetadata, RegionLevel } from "@/components/region-search"

type MapMode = "value" | "growth"

/** Calculate CAGR (Compound Annual Growth Rate) */
function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years === 0) return 0
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

interface FullWidthMapProps {
  selectedRegion: string
  selectedRegionMetadata?: RegionMetadata | null
  mapMetric: string
  year: number
  scenario: Scenario
  allMetricsData: {
    metricId: string
    value: number
  }[]
  allMetricsSeriesData?: {
    metricId: string
    data: DataPoint[]
  }[]
  onRegionSelect: (metadata: RegionMetadata) => void
  onMapMetricChange: (metric: string) => void
  onYearChange?: (year: number) => void
  onScenarioChange?: (scenario: Scenario) => void
  onExport?: () => void
  onFullscreenChange?: (isFullscreen: boolean) => void
}

export function FullWidthMap({
  selectedRegion,
  selectedRegionMetadata,
  mapMetric,
  year,
  scenario,
  allMetricsData,
  allMetricsSeriesData,
  onRegionSelect,
  onMapMetricChange,
  onYearChange,
  onScenarioChange,
  onExport,
  onFullscreenChange,
}: FullWidthMapProps) {
  // Auto-switch level based on selected region metadata
  const [level, setLevel] = useState<RegionLevel>("ITL1")
  const [mapMode, setMapMode] = useState<MapMode>("value")
  const [growthPeriod, setGrowthPeriod] = useState<number>(5) // Default to 5yr for backward compatibility
  
  useEffect(() => {
    if (selectedRegionMetadata) {
      setLevel(selectedRegionMetadata.level)
    }
  }, [selectedRegionMetadata])
  const [rankData, setRankData] = useState<{
    rank: number
    total: number
    percentile: number
    allRegions: Array<{ code: string; name: string; value: number }>
    // Growth-specific data
    growthRank?: number
    growthTotal?: number
    growthPercentile?: number
    allGrowthRegions?: Array<{ code: string; name: string; cagr: number }>
  } | null>(null)
  const [isLoadingRank, setIsLoadingRank] = useState(false)

  const region = REGIONS.find((r) => r.code === selectedRegion)
  const selectedMetric = METRICS.find((m) => m.id === mapMetric)
  
  // Calculate YoY change if time series data is available
  const metricSeriesData = allMetricsSeriesData?.find((d) => d.metricId === mapMetric)
  const currentYearData = metricSeriesData?.data.find((d) => d.year === year)
  
  // Use time series data for the selected region (more reliable than allMetricsData which may be for wrong region)
  // Note: allMetricsData is built from URL region, not map-selected region
  const mapMetricValue = currentYearData?.value ?? allMetricsData.find((d) => d.metricId === mapMetric)?.value
  const previousYearData = metricSeriesData?.data.find((d) => d.year === year - 1)
  const periodYearsAgoData = metricSeriesData?.data.find((d) => d.year === year - growthPeriod)
  const yoyChange = currentYearData && previousYearData
    ? calculateChange(currentYearData.value, previousYearData.value)
    : null
  // Calculate growth rate: YoY uses simple % change, longer periods use CAGR
  const growthRate = currentYearData && periodYearsAgoData
    ? (growthPeriod === 1
        ? calculateChange(currentYearData.value, periodYearsAgoData.value)
        : calculateCAGR(periodYearsAgoData.value, currentYearData.value, growthPeriod))
    : null

  // Determine map type for canonical color system
  const getMapTypeForMetric = (mode: MapMode, metricId: string): MapType => {
    if (mode === "value") return "level"
    return getGrowthMapType(metricId)
  }
  
  const mapType = getMapTypeForMetric(mapMode, mapMetric)
  
  // Generate legend colors using canonical map color system
  // This ensures legend matches the map exactly
  const rampColors = useMemo(() => {
    if (mapType === "level") {
      // Sequential blue scale - sample at key points
      return [
        getMapColorForValue({ mapType: "level", value: 0, domain: [0, 100] }), // positive-light
        getMapColorForValue({ mapType: "level", value: 25, domain: [0, 100] }), // positive-mid
        getMapColorForValue({ mapType: "level", value: 50, domain: [0, 100] }), // positive
        getMapColorForValue({ mapType: "level", value: 75, domain: [0, 100] }), // positive-dark
        getMapColorForValue({ mapType: "level", value: 100, domain: [0, 100] }), // positive-dark
      ]
    } else {
      // Diverging scale - sample across negative → neutral → positive
      return [
        getMapColorForValue({ mapType: "growth", value: -50, domain: [-50, 50], midpoint: 0 }), // negative-dark
        getMapColorForValue({ mapType: "growth", value: -25, domain: [-50, 50], midpoint: 0 }), // negative-mid
        getMapColorForValue({ mapType: "growth", value: -10, domain: [-50, 50], midpoint: 0 }), // negative-light
        getMapColorForValue({ mapType: "growth", value: 0, domain: [-50, 50], midpoint: 0 }), // neutral
        getMapColorForValue({ mapType: "growth", value: 10, domain: [-50, 50], midpoint: 0 }), // positive-light
        getMapColorForValue({ mapType: "growth", value: 25, domain: [-50, 50], midpoint: 0 }), // positive-mid
        getMapColorForValue({ mapType: "growth", value: 50, domain: [-50, 50], midpoint: 0 }), // positive-dark
      ]
    }
  }, [mapType])
  const levels: RegionLevel[] = ["ITL1", "ITL2", "ITL3", "LAD"]

  // Fetch ranking data (both value and growth)
  useEffect(() => {
    let cancelled = false
    setIsLoadingRank(true)
    
    ;(async () => {
      try {
        // Fetch current year data
        const choroplethData = await fetchChoropleth({
          metricId: mapMetric,
          level,
          year,
          scenario,
        })

        // Fetch past year data for growth calculation (will be fetched in growth rank section)

        if (cancelled) return

        // Convert to array and sort by value (descending)
        const regionsWithValues = Object.entries(choroplethData.values)
          .map(([code, value]) => {
            const regionInfo = REGIONS.find((r) => r.code === code)
            return {
              code,
              name: regionInfo?.name || code,
              value,
            }
          })
          .filter((r) => r.value != null && isFinite(r.value))
          .sort((a, b) => b.value - a.value)

        // Find rank of selected region by value
        const selectedIndex = regionsWithValues.findIndex((r) => r.code === selectedRegion)
        const rank = selectedIndex >= 0 ? selectedIndex + 1 : 0
        const total = regionsWithValues.length
        const percentile = total > 0 ? Math.round(((total - rank) / total) * 100) : 0

        // Calculate growth rank (by selected period growth rate)
        const pastYear = year - growthPeriod
        const choroplethDataPast = await fetchChoropleth({
          metricId: mapMetric,
          level,
          year: pastYear,
          scenario,
        })
        
        const regionsWithGrowth = Object.entries(choroplethData.values)
          .map(([code, currentValue]) => {
            const pastValue = choroplethDataPast.values[code]
            const regionInfo = REGIONS.find((r) => r.code === code)
            // YoY uses simple % change, longer periods use CAGR
            const growth = pastValue != null && pastValue > 0 && currentValue != null
              ? (growthPeriod === 1
                  ? calculateChange(currentValue, pastValue)
                  : calculateCAGR(pastValue, currentValue, growthPeriod))
              : null
            return {
              code,
              name: regionInfo?.name || code,
              growth: growth ?? 0,
              hasValidGrowth: growth !== null,
            }
          })
          .filter((r) => r.hasValidGrowth)
          .sort((a, b) => b.growth - a.growth) // Higher growth = better rank

        const selectedGrowthIndex = regionsWithGrowth.findIndex((r) => r.code === selectedRegion)
        const growthRank = selectedGrowthIndex >= 0 ? selectedGrowthIndex + 1 : 0
        const growthTotal = regionsWithGrowth.length
        const growthPercentile = growthTotal > 0 ? Math.round(((growthTotal - growthRank) / growthTotal) * 100) : 0

        if (!cancelled) {
          setRankData({
            rank,
            total,
            percentile,
            allRegions: regionsWithValues,
            growthRank,
            growthTotal,
            growthPercentile,
            allGrowthRegions: regionsWithGrowth.map(({ code, name, growth }) => ({ code, name, cagr: growth })),
          })
        }
      } catch (error) {
        console.error("Failed to fetch ranking data:", error)
        if (!cancelled) {
          setRankData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRank(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mapMetric, level, year, scenario, selectedRegion, growthPeriod])

  return (
    <div className="w-full bg-neutral-50/80 dark:bg-neutral-900/30 rounded-xl border border-border/50 overflow-hidden shadow-sm">
      {/* Full-width contextual header with badge inline */}
      <div className="px-6 py-3 bg-background/50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Regional Map — {selectedMetric?.title || "Economic Indicators"}
          </h2>
          <Badge variant="outline" className="text-xs font-medium">
            {year} • {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
          </Badge>
        </div>
      </div>

      {/* KPI Row - no border, directly connected to header */}
      <div className="px-6 py-1.5 bg-background/30">
        <div className="flex items-center gap-6 text-sm">
          {/* Region Name */}
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Region</div>
            <div className="font-semibold text-foreground">{region?.name || selectedRegion}</div>
          </div>
          
          {/* Metric Value */}
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">{selectedMetric?.title}</div>
            <div className="font-semibold text-foreground">
              {mapMetricValue != null
                ? formatValue(mapMetricValue, selectedMetric?.unit || "", selectedMetric?.decimals || 0)
                : "—"}
            </div>
          </div>
          
          {/* YoY Change */}
          {yoyChange !== null && (
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">YoY Change</div>
              <div
                className={cn(
                  "font-semibold flex items-center gap-1",
                  yoyChange >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {yoyChange >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {formatPercentage(yoyChange)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map container - increased height to 600px, flex layout with fixed sidebar */}
      <div className="h-[600px]">
        <div className="flex flex-col lg:flex-row h-full gap-0">
          {/* Map section - flex-1 with min-width constraint, no padding */}
          <div
            id="tour-map-viewport"
            className="flex-1 min-w-0 relative overflow-hidden min-h-[250px] lg:min-h-full"
          >
            <MapScaffold
              selectedRegion={selectedRegion}
              selectedRegionMetadata={selectedRegionMetadata}
              metric={mapMetric}
              year={year}
              scenario={scenario}
              level={level}
              mapMode={mapMode}
              growthPeriod={growthPeriod}
              onLevelChange={setLevel}
              onRegionSelect={onRegionSelect}
              onMetricChange={onMapMetricChange}
              onMapModeChange={setMapMode}
              onGrowthPeriodChange={setGrowthPeriod}
              onYearChange={onYearChange}
              onScenarioChange={onScenarioChange}
              onExport={onExport}
              onFullscreenChange={onFullscreenChange}
              mapId="dashboard-map"
              className="h-full"
              showRegionInfo={false}
              hideHeader={true}
            />
          </div>

          {/* Vertical Divider */}
          <div className="hidden lg:block w-px bg-border/60 shrink-0" />

          {/* Sidebar - fixed width 340px, full height, flex column, editorial style */}
          <div className="w-full lg:w-[340px] lg:shrink-0 bg-card/80 backdrop-blur-sm border-t lg:border-t-0 lg:border-l border-neutral-200/40 dark:border-border/40 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] p-3 flex flex-col h-full overflow-hidden">
            {/* Top Section - Fixed (Map Display & Granularity) */}
            <div className="flex-shrink-0">
              {/* Map Display Mode Toggle */}
              <div className="space-y-2 mb-3">
              <h4 className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">Map Display</h4>
              <div className="flex rounded-lg border border-neutral-200/40 dark:border-border/40 p-0.5 bg-muted/30">
                <Button
                  variant={mapMode === "value" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMapMode("value")}
                  className={cn(
                    "flex-1 text-xs h-7 px-2",
                    mapMode === "value"
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "bg-transparent hover:bg-background/50 text-muted-foreground"
                  )}
                >
                  Absolute Value
                </Button>
                <Button
                  variant={mapMode === "growth" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMapMode("growth")}
                  className={cn(
                    "flex-1 text-xs h-7 px-2",
                    mapMode === "growth"
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "bg-transparent hover:bg-background/50 text-muted-foreground"
                  )}
                >
                  Growth Rate
                </Button>
              </div>
              {mapMode === "growth" && (
                <>
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Growth Period</h5>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 5, 10].map((period) => (
                        <Button
                          key={period}
                          variant={growthPeriod === period ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setGrowthPeriod(period)}
                          className={cn(
                            "text-xs h-6 px-2",
                            growthPeriod === period
                              ? "bg-background shadow-sm text-foreground font-medium"
                              : "bg-transparent hover:bg-background/50 text-muted-foreground"
                          )}
                        >
                          {period === 1 ? "YoY" : `${period}yr`}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {growthPeriod === 1 
                      ? `Year-over-year change`
                      : `Growth from ${year - growthPeriod} to ${year}`}
                  </p>
                </>
              )}
            </div>

              {/* Granularity Selector */}
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">Granularity</h4>
                <div className="flex rounded-lg border border-neutral-200/40 dark:border-border/40 p-0.5 bg-muted/30">
                  {levels.map((l) => (
                    <Button
                      key={l}
                      variant={level === l ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setLevel(l)}
                      className={cn(
                        "flex-1 text-xs h-7 px-2",
                        level === l
                          ? "bg-background shadow-sm text-foreground font-medium"
                          : "bg-transparent hover:bg-background/50 text-muted-foreground"
                      )}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Section - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-3 px-3">
              {/* Indicators */}
              <div className="space-y-2 mb-3">
              <h4 className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">Indicators</h4>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-0.5">
                {METRICS.map((metric) => {
                  const isSelected = metric.id === mapMetric
                  return (
                    <Button
                      key={metric.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => onMapMetricChange(metric.id)}
                      className={cn(
                        "w-full justify-start gap-2 h-7 text-xs",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="truncate">• {metric.title}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-200/40 dark:border-border/40 my-2" />

            {/* Local Political Summary - HIDDEN FOR V1
                Local election data is complex (thirds elections, mayoral vs council, etc.)
                Keeping Westminster context which is clearer and more accurate.
                To re-enable, uncomment:
            {level === "LAD" && (
              <div className="mb-3">
                <PoliticalSummary ladCode={selectedRegion} year={year} />
              </div>
            )}
            */}

            {/* Insight Summary Block (hero takeaway) */}
            <div className="space-y-2 mb-1.5">
              {isLoadingRank ? (
                <div className="text-xs text-neutral-500 dark:text-neutral-400">Loading...</div>
              ) : rankData ? (
                <div className="space-y-1.5">
                  <div className="text-sm text-foreground">
                    {region?.name} ({selectedRegion})
                  </div>
                  {mapMode === "value" ? (
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">
                        {mapMetricValue != null
                          ? formatValue(mapMetricValue, selectedMetric?.unit || "", selectedMetric?.decimals || 0)
                          : "—"}
                      </span>
                      {yoyChange !== null && (
                        <span className={cn(
                          "ml-1.5 text-sm",
                          yoyChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                          • {formatPercentage(yoyChange)} YoY
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">
                      {growthRate !== null ? (
                        <>
                          <span className={cn(
                            "font-semibold",
                            growthRate >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {growthRate >= 0 ? "+" : ""}{growthRate.toFixed(1)}%
                            {growthPeriod === 1 ? "" : " CAGR"}
                          </span>
                          <span className="ml-1.5 text-muted-foreground text-xs">
                            {growthPeriod === 1 
                              ? "(YoY)"
                              : `(${year - growthPeriod}–${year})`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No growth data available</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-neutral-500 dark:text-neutral-400">No data available</div>
              )}
            </div>

            {/* Graphic Rank Strip */}
            {rankData && rankData.allRegions.length > 0 && (
              <div className="space-y-2 mb-1.5">
                <h4 className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">
                  {mapMode === "growth" 
                    ? `Growth Rank (${growthPeriod === 1 ? "YoY" : `${year - growthPeriod}–${year}`})`
                    : "Regional Rank (by value)"}
                </h4>
                {/* Labels */}
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{mapMode === "growth" ? "Declining" : "Low Rank"}</span>
                  <span>{mapMode === "growth" ? "Growing" : "High Rank"}</span>
                </div>
                {/* Slider */}
                <div className="relative w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full">
                  {/* Selected region indicator */}
                  {mapMode === "value" ? (
                    <div
                      className="absolute top-0 h-2 rounded-full transition-all"
                      style={{
                        left: rankData.total > 1 
                          ? `${((rankData.total - rankData.rank) / (rankData.total - 1)) * 100}%`
                          : '0%',
                        width: `${Math.max((1 / rankData.total) * 100, 2)}%`,
                        // Color interpolation: red (low rank) to green (high rank)
                        backgroundColor: rankData.total > 1
                          ? (() => {
                              const position = (rankData.total - rankData.rank) / (rankData.total - 1)
                              const red = Math.round(255 * (1 - position))
                              const green = Math.round(255 * position)
                              return `rgb(${red}, ${green}, 0)`
                            })()
                          : 'rgb(128, 128, 0)',
                      }}
                      title={`${region?.name}: ${mapMetricValue != null ? formatValue(mapMetricValue, selectedMetric?.unit || "", selectedMetric?.decimals || 0) : "No data"}`}
                    />
                  ) : (
                    <div
                      className="absolute top-0 h-2 rounded-full transition-all"
                      style={{
                        left: (rankData.growthTotal ?? 1) > 1 && (rankData.growthRank ?? 0) > 0
                          ? `${(((rankData.growthTotal ?? 1) - (rankData.growthRank ?? 0)) / ((rankData.growthTotal ?? 1) - 1)) * 100}%`
                          : '0%',
                        width: `${Math.max((1 / (rankData.growthTotal ?? 1)) * 100, 2)}%`,
                        // Color: red for low growth rank (declining), green for high growth rank
                        backgroundColor: (rankData.growthTotal ?? 1) > 1 && (rankData.growthRank ?? 0) > 0
                          ? (() => {
                              const position = ((rankData.growthTotal ?? 1) - (rankData.growthRank ?? 0)) / ((rankData.growthTotal ?? 1) - 1)
                              const red = Math.round(255 * (1 - position))
                              const green = Math.round(255 * position)
                              return `rgb(${red}, ${green}, 0)`
                            })()
                          : 'rgb(128, 128, 0)',
                      }}
                      title={`${region?.name}: ${growthRate !== null ? `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%${growthPeriod === 1 ? "" : " CAGR"}` : "No data"}`}
                    />
                  )}
                </div>
                {/* Rank text */}
                <div className="text-sm text-neutral-500 dark:text-neutral-400 text-center font-medium">
                  {mapMode === "value" ? (
                    <>Rank {rankData.rank} / {rankData.total} ({rankData.percentile}th percentile)</>
                  ) : (
                    <>Rank {rankData.growthRank ?? 0} / {rankData.growthTotal ?? 0} ({rankData.growthPercentile ?? 0}th percentile)</>
                  )}
                </div>
                {/* Contextual insight */}
                <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                  {mapMode === "value" ? (
                    rankData.percentile >= 50
                      ? "Above-median performance relative to other UK regions."
                      : rankData.percentile >= 25
                      ? "Below-median performance relative to other UK regions."
                      : "Bottom-quartile performance relative to other UK regions."
                  ) : (
                    (rankData.growthPercentile ?? 0) >= 50
                      ? "Above-median growth relative to other UK regions."
                      : (rankData.growthPercentile ?? 0) >= 25
                      ? "Below-median growth relative to other UK regions."
                      : "Bottom-quartile growth relative to other UK regions."
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Bottom Section - Fixed (Scale & Footer) */}
            <div className="flex-shrink-0 border-t border-neutral-200/40 dark:border-border/40 pt-2 mt-2">
              {/* Scale - tightened */}
              <div className="space-y-1.5 mb-1.5">
              <h5 className="text-xs font-medium tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">Scale</h5>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
                  {rampColors.map((c, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                {mapMode === "growth" ? (
                  (() => {
                    // Use canonical map type to determine labels
                    // Diverging scale: weaker (red-orange) → neutral → stronger (blue)
                    // Sequential scale: lower (light blue) → higher (dark blue)
                    const useDiverging = DIVERGING_GROWTH_METRICS.has(mapMetric)
                    return useDiverging ? (
                      <>
                        <span>Weaker</span>
                        <span>0%</span>
                        <span>Stronger</span>
                      </>
                    ) : (
                      <>
                        <span>Lower</span>
                        <span>Higher</span>
                      </>
                    )
                  })()
                ) : (
                  <>
                    <span>Lower</span>
                    <span>Higher</span>
                  </>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
