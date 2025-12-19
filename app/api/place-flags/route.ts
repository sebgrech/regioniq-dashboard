import { type NextRequest, NextResponse } from "next/server"
import { METRICS, REGIONS } from "@/lib/metrics.config"
import { calculateChange, type DataPoint } from "@/lib/data-service"
import { detectRegionLevel } from "@/lib/insights/region-helpers"
import fs from "fs"
import path from "path"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PlaceFlagsRequest {
  regionCode: string
  regionName: string
  year: number
  allMetricsData: { metricId: string; data: DataPoint[] }[]
}

interface PlaceFlag {
  id: string
  type: "extreme" | "surge" | "recovery" | "record"
  metricId: string
  metricName: string
  headline: string        // e.g., "+87%"
  subline: string         // e.g., "Population 2020-21"
  signal: "positive" | "negative" | "neutral"
  percentile?: number     // 0-100 for gauge
  sparkline?: number[]    // normalized 0-100 values for sparkline
  priority: number        // for sorting
}

interface PlaceFlagsResponse {
  flags: PlaceFlag[]
  hasFlags: boolean
  timestamp: string
}

interface PercentileData {
  p10: number
  p90: number
  min: number
  max: number
  maxRegion: string
  minRegion: string
  count: number
}

interface MetricPercentiles {
  value: PercentileData
  growth: PercentileData
  latestYear: number
}

type PercentilesJSON = {
  [metricId: string]: {
    [level: string]: MetricPercentiles
  }
}

// -----------------------------------------------------------------------------
// Load percentiles (cached)
// -----------------------------------------------------------------------------

let percentilesCache: PercentilesJSON | null = null

function loadPercentiles(): PercentilesJSON {
  if (percentilesCache) return percentilesCache
  
  try {
    const filePath = path.join(process.cwd(), "public/data/metric-percentiles.json")
    const content = fs.readFileSync(filePath, "utf-8")
    percentilesCache = JSON.parse(content)
    return percentilesCache!
  } catch (error) {
    console.error("Failed to load percentiles:", error)
    return {}
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const METRIC_NAMES: Record<string, string> = {
  population_total: "Population",
  population_16_64: "Working Age",
  nominal_gva_mn_gbp: "GVA",
  gdhi_per_head_gbp: "Income",
  emp_total_jobs: "Employment",
  employment_rate_pct: "Employment Rate",
  unemployment_rate_pct: "Unemployment",
}

function getMetricName(metricId: string): string {
  return METRIC_NAMES[metricId] ?? metricId
}

function computeSparkline(data: DataPoint[]): number[] {
  const historical = data
    .filter(d => d.type === "historical")
    .sort((a, b) => a.year - b.year)
    .slice(-10) // Last 10 years
  
  if (historical.length < 3) return []
  
  const values = historical.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  
  return values.map(v => Math.round(((v - min) / range) * 100))
}

function computeTopPercentage(value: number, p90: number, max: number): number {
  // Calculate position within top 10% (between p90 and max)
  // Returns 1-10 representing "Top X%"
  if (value >= max) return 1
  if (value <= p90) return 10
  
  const range = max - p90
  if (range <= 0) return 10
  
  // How far into the top 10% are we?
  const positionInTop10 = (value - p90) / range
  // Convert to percentage: closer to max = lower number (Top 1%), closer to p90 = higher (Top 10%)
  return Math.max(1, Math.round(10 - positionInTop10 * 9))
}

// -----------------------------------------------------------------------------
// Flag Detection Functions
// -----------------------------------------------------------------------------

function checkNationalExtreme(
  metricId: string,
  data: DataPoint[],
  regionCode: string,
  percentiles: MetricPercentiles | null
): PlaceFlag | null {
  if (!percentiles) return null
  
  const historical = data.filter(d => d.type === "historical").sort((a, b) => a.year - b.year)
  const latest = historical[historical.length - 1]
  if (!latest) return null
  
  const region = REGIONS.find(r => r.code === regionCode)
  const dbCode = region?.dbCode ?? regionCode
  const metricName = getMetricName(metricId)
  
  // Check if highest nationally
  if (percentiles.value.maxRegion === dbCode) {
    return {
      id: `extreme-high-${metricId}`,
      type: "extreme",
      metricId,
      metricName,
      headline: "#1",
      subline: `Highest ${metricName.toLowerCase()} nationally`,
      signal: "positive",
      percentile: 100,
      sparkline: computeSparkline(data),
      priority: 100,
    }
  }
  
  // Check if in top 10%
  if (latest.value >= percentiles.value.p90) {
    const topPct = computeTopPercentage(latest.value, percentiles.value.p90, percentiles.value.max)
    return {
      id: `top-${metricId}`,
      type: "extreme",
      metricId,
      metricName,
      headline: `Top ${topPct}%`,
      subline: `${metricName} nationally`,
      signal: "positive",
      percentile: 100 - topPct,
      sparkline: computeSparkline(data),
      priority: 90,
    }
  }
  
  // Check if lowest nationally
  if (percentiles.value.minRegion === dbCode) {
    return {
      id: `extreme-low-${metricId}`,
      type: "extreme",
      metricId,
      metricName,
      headline: "Lowest",
      subline: `${metricName} nationally`,
      signal: "negative",
      percentile: 0,
      sparkline: computeSparkline(data),
      priority: 85,
    }
  }
  
  return null
}

function checkSurge(
  metricId: string,
  data: DataPoint[]
): PlaceFlag | null {
  const historical = data.filter(d => d.type === "historical").sort((a, b) => a.year - b.year)
  if (historical.length < 4) return null
  
  // Compute all YoY changes
  const changes: { year: number; change: number }[] = []
  for (let i = 1; i < historical.length; i++) {
    if (historical[i - 1].value !== 0) {
      changes.push({
        year: historical[i].year,
        change: calculateChange(historical[i].value, historical[i - 1].value)
      })
    }
  }
  
  if (changes.length < 3) return null
  
  const currentChange = changes[changes.length - 1]
  const pastChanges = changes.slice(0, -1).map(c => c.change)
  const avgChange = pastChanges.reduce((a, b) => a + b, 0) / pastChanges.length
  const absAvg = Math.abs(avgChange)
  const absCurrent = Math.abs(currentChange.change)
  
  // Only flag if current is 3x+ the historical average AND significant (>5%)
  if (absAvg > 0.5 && absCurrent > 5 && absCurrent > absAvg * 3) {
    const metricName = getMetricName(metricId)
    const isPositive = currentChange.change > 0
    const prevYear = currentChange.year - 1
    
    return {
      id: `surge-${metricId}`,
      type: "surge",
      metricId,
      metricName,
      headline: `${isPositive ? "+" : ""}${currentChange.change.toFixed(0)}%`,
      subline: `${metricName} ${prevYear}-${currentChange.year}`,
      signal: isPositive ? "positive" : "negative",
      sparkline: computeSparkline(data),
      priority: 95,
    }
  }
  
  return null
}

function checkCovidRecovery(
  metricId: string,
  data: DataPoint[],
  currentYear: number
): PlaceFlag | null {
  if (currentYear < 2021 || currentYear > 2025) return null
  
  const historical = data.filter(d => d.type === "historical").sort((a, b) => a.year - b.year)
  const baseline2019 = historical.find(d => d.year === 2019)
  const latest = historical[historical.length - 1]
  
  if (!baseline2019 || !latest) return null
  
  const changeFrom2019 = ((latest.value - baseline2019.value) / baseline2019.value) * 100
  const metricName = getMetricName(metricId)
  
  // Flag significant deviations from 2019
  if (changeFrom2019 < -8) {
    return {
      id: `recovery-below-${metricId}`,
      type: "recovery",
      metricId,
      metricName,
      headline: `${changeFrom2019.toFixed(0)}%`,
      subline: `${metricName} vs 2019`,
      signal: "negative",
      sparkline: computeSparkline(data),
      priority: 80,
    }
  }
  
  if (changeFrom2019 > 15) {
    return {
      id: `recovery-above-${metricId}`,
      type: "recovery",
      metricId,
      metricName,
      headline: `+${changeFrom2019.toFixed(0)}%`,
      subline: `${metricName} vs 2019`,
      signal: "positive",
      sparkline: computeSparkline(data),
      priority: 82,
    }
  }
  
  return null
}

// -----------------------------------------------------------------------------
// API Handler
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: PlaceFlagsRequest = await request.json()
    const { regionCode, regionName, year, allMetricsData } = body

    console.log(`[Place Flags] Scanning ${regionName} (${regionCode})`)

    const percentiles = loadPercentiles()
    const regionLevel = detectRegionLevel(regionCode)
    
    const allFlags: PlaceFlag[] = []
    
    // Scan ALL metrics for flags
    for (const { metricId, data } of allMetricsData) {
      const metricPercentiles = regionLevel 
        ? percentiles[metricId]?.[regionLevel] ?? null 
        : null
      
      // Check for national extremes
      const extreme = checkNationalExtreme(metricId, data, regionCode, metricPercentiles)
      if (extreme) allFlags.push(extreme)
      
      // Check for surges
      const surge = checkSurge(metricId, data)
      if (surge) allFlags.push(surge)
      
      // Check for COVID recovery
      const recovery = checkCovidRecovery(metricId, data, year)
      if (recovery) allFlags.push(recovery)
    }
    
    // Sort by priority and take top 3
    const sortedFlags = allFlags.sort((a, b) => b.priority - a.priority).slice(0, 3)
    
    console.log(`[Place Flags] Found ${sortedFlags.length} flags for ${regionName}`)
    
    return NextResponse.json({
      flags: sortedFlags,
      hasFlags: sortedFlags.length > 0,
      timestamp: new Date().toISOString(),
    } satisfies PlaceFlagsResponse)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("❌ Place flags error:", message)

    return NextResponse.json(
      {
        flags: [],
        hasFlags: false,
        timestamp: new Date().toISOString(),
      } satisfies PlaceFlagsResponse,
      { status: 500 }
    )
  }
}

