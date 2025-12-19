import { type NextRequest, NextResponse } from "next/server"
import { METRICS, REGIONS } from "@/lib/metrics.config"
import { calculateChange, type DataPoint } from "@/lib/data-service"
import { detectRegionLevel } from "@/lib/insights/region-helpers"
import fs from "fs"
import path from "path"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MetricAnalysisRequest {
  metricId: string
  region: string
  regionName: string
  year: number
  scenario: string
  currentData: DataPoint[]
  allScenariosData: { scenario: string; data: DataPoint[] }[]
  allMetricsData?: { metricId: string; data: DataPoint[] }[]
}

interface MetricAnalysisResponse {
  bullets: string[]
  hasAnomalies: boolean
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

function getYoY(data: DataPoint[], targetYear: number): number | null {
  const historical = data
    .filter((d) => d.type === "historical" && d.year <= targetYear)
    .sort((a, b) => a.year - b.year)

  if (historical.length < 2) return null

  const current = historical[historical.length - 1]
  const previous = historical[historical.length - 2]

  if (!current || !previous || previous.value === 0) return null
  return calculateChange(current.value, previous.value)
}

function computeScenarioDivergence(
  allScenariosData: { scenario: string; data: DataPoint[] }[],
  threshold: number = 5
): { year: number | null; spread: number } {
  const baseline = allScenariosData.find((s) => s.scenario === "baseline")?.data ?? []
  const upside = allScenariosData.find((s) => s.scenario === "upside")?.data ?? []
  const downside = allScenariosData.find((s) => s.scenario === "downside")?.data ?? []

  for (const point of baseline) {
    if (point.type !== "forecast") continue

    const baseVal = point.value
    const upVal = upside.find((d) => d.year === point.year)?.value
    const downVal = downside.find((d) => d.year === point.year)?.value

    if (baseVal == null || upVal == null || downVal == null || baseVal === 0) continue

    const spread = ((upVal - downVal) / baseVal) * 100
    if (spread >= threshold) {
      return { year: point.year, spread }
    }
  }

  return { year: null, spread: 0 }
}

function computeMomentum(
  currentData: DataPoint[]
): { momentum: "accelerating" | "decelerating" | "stable"; recentAvg: number; longTermAvg: number } {
  const historical = currentData.filter((d) => d.type === "historical").sort((a, b) => a.year - b.year)
  
  const yoyChanges: number[] = []
  for (let i = 1; i < historical.length; i++) {
    yoyChanges.push(calculateChange(historical[i].value, historical[i - 1].value))
  }
  
  const recentAvg = yoyChanges.slice(-2).reduce((a, b) => a + b, 0) / Math.max(yoyChanges.slice(-2).length, 1)
  const longTermAvg = yoyChanges.slice(-5).reduce((a, b) => a + b, 0) / Math.max(yoyChanges.slice(-5).length, 1)
  
  const momentum = recentAvg > longTermAvg + 0.5 
    ? "accelerating" 
    : recentAvg < longTermAvg - 0.5 
      ? "decelerating" 
      : "stable"
  
  return { momentum, recentAvg, longTermAvg }
}

// -----------------------------------------------------------------------------
// Anomaly Checks
// -----------------------------------------------------------------------------

interface AnomalyContext {
  metricId: string
  metricTitle: string
  regionCode: string
  regionName: string
  regionLevel: string
  currentValue: number
  currentYear: number
  yoyGrowth: number | null
  momentum: "accelerating" | "decelerating" | "stable"
  recentAvg: number
  longTermAvg: number
  scenarioDivergence: { year: number | null; spread: number }
  percentiles: MetricPercentiles | null
  allMetricsData?: { metricId: string; data: DataPoint[] }[]
  year: number
  historicalData: DataPoint[]
  allYoYChanges: { year: number; change: number }[]
}

/**
 * Check if value is in top 10% nationally
 */
function checkTopDecile(ctx: AnomalyContext): string | null {
  if (!ctx.percentiles) return null
  
  // Check value
  if (ctx.currentValue >= ctx.percentiles.value.p90) {
    return `Top 10% ${ctx.metricTitle.toLowerCase()} nationally`
  }
  
  // Check growth
  if (ctx.yoyGrowth !== null && ctx.yoyGrowth >= ctx.percentiles.growth.p90) {
    return `Top 10% growth nationally`
  }
  
  return null
}

/**
 * Check if value is in bottom 10% nationally
 */
function checkBottomDecile(ctx: AnomalyContext): string | null {
  if (!ctx.percentiles) return null
  
  // Check value
  if (ctx.currentValue <= ctx.percentiles.value.p10) {
    return `Bottom 10% ${ctx.metricTitle.toLowerCase()} nationally`
  }
  
  // Check growth
  if (ctx.yoyGrowth !== null && ctx.yoyGrowth <= ctx.percentiles.growth.p10) {
    return `Bottom 10% growth nationally`
  }
  
  return null
}

/**
 * Check for high scenario divergence
 */
function checkScenarioDivergence(ctx: AnomalyContext): string | null {
  if (!ctx.scenarioDivergence.year) return null
  
  if (ctx.scenarioDivergence.spread >= 15) {
    return `High forecast uncertainty after ${ctx.scenarioDivergence.year}`
  }
  
  return null
}

/**
 * Check if this is the highest/lowest value nationally
 */
function checkExtreme(ctx: AnomalyContext): string | null {
  if (!ctx.percentiles) return null
  
  const region = REGIONS.find(r => r.code === ctx.regionCode)
  const dbCode = region?.dbCode ?? ctx.regionCode
  
  if (ctx.percentiles.value.maxRegion === dbCode) {
    return `Highest ${ctx.metricTitle.toLowerCase()} nationally`
  }
  
  if (ctx.percentiles.value.minRegion === dbCode) {
    return `Lowest ${ctx.metricTitle.toLowerCase()} nationally`
  }
  
  if (ctx.percentiles.growth.maxRegion === dbCode && ctx.yoyGrowth !== null && ctx.yoyGrowth > 0) {
    return `Fastest growing nationally`
  }
  
  if (ctx.percentiles.growth.minRegion === dbCode && ctx.yoyGrowth !== null && ctx.yoyGrowth < 0) {
    return `Weakest growth nationally`
  }
  
  return null
}

/**
 * Check momentum (accelerating/decelerating)
 */
function checkMomentum(ctx: AnomalyContext): string | null {
  const metricShort = getMetricShortName(ctx.metricId)
  
  if (ctx.momentum === "accelerating" && ctx.recentAvg > 1) {
    return `${metricShort} growth accelerating: ${ctx.recentAvg.toFixed(1)}% recent vs ${ctx.longTermAvg.toFixed(1)}% 5yr avg`
  }
  
  if (ctx.momentum === "decelerating" && ctx.recentAvg < ctx.longTermAvg - 1) {
    return `${metricShort} growth slowing: ${ctx.recentAvg.toFixed(1)}% recent vs ${ctx.longTermAvg.toFixed(1)}% 5yr avg`
  }
  
  return null
}

// -----------------------------------------------------------------------------
// Temporal Anomaly Checks (within-region historical)
// -----------------------------------------------------------------------------

/**
 * Check for unusual YoY spike/drop compared to this region's own history
 * "Population surge of 11% (2020-2021), 3.5x typical"
 */
function checkHistoricalSpike(ctx: AnomalyContext): string | null {
  if (ctx.yoyGrowth === null || ctx.allYoYChanges.length < 3) return null
  
  // Get historical YoY changes (excluding current)
  const pastChanges = ctx.allYoYChanges.slice(0, -1).map(c => c.change)
  if (pastChanges.length < 2) return null
  
  const avgChange = pastChanges.reduce((a, b) => a + b, 0) / pastChanges.length
  const absAvg = Math.abs(avgChange)
  const absCurrent = Math.abs(ctx.yoyGrowth)
  
  // Only flag if current is 3x+ the historical average AND significant (>5%)
  if (absAvg > 0.5 && absCurrent > 5 && absCurrent > absAvg * 3) {
    const multiplier = (absCurrent / absAvg).toFixed(1)
    const direction = ctx.yoyGrowth > 0 ? "surge" : "drop"
    const metricShort = getMetricShortName(ctx.metricId)
    const prevYear = ctx.currentYear - 1
    return `${metricShort} ${direction} of ${Math.abs(ctx.yoyGrowth).toFixed(0)}% (${prevYear}-${ctx.currentYear}), ${multiplier}x typical`
  }
  
  return null
}

/** Get short metric name for place-centric phrasing */
function getMetricShortName(metricId: string): string {
  const names: Record<string, string> = {
    population_total: "Population",
    population_16_64: "Working-age population",
    nominal_gva_mn_gbp: "GVA",
    gdhi_per_head_gbp: "Income",
    emp_total_jobs: "Employment",
    employment_rate_pct: "Employment rate",
    unemployment_rate_pct: "Unemployment",
  }
  return names[metricId] ?? "Metric"
}

/**
 * Check if current value is a record high/low for this region
 * Only flags if the previous record was NOT at the start of data (that would be obvious)
 */
function checkRegionalRecord(ctx: AnomalyContext): string | null {
  if (ctx.historicalData.length < 8) return null // Need substantial history
  
  const values = ctx.historicalData.map(d => ({ year: d.year, value: d.value }))
  const sortedByValue = [...values].sort((a, b) => b.value - a.value)
  const earliestYear = Math.min(...values.map(v => v.year))
  const yearsOfData = ctx.currentYear - earliestYear
  
  // Need at least 10 years of data for this to be meaningful
  if (yearsOfData < 10) return null
  
  // Check if current is the record high
  if (ctx.currentValue >= sortedByValue[0].value && ctx.currentYear === sortedByValue[0].year) {
    // Find when the previous record was set
    const previousRecord = sortedByValue.find(p => p.year !== ctx.currentYear)
    if (previousRecord && previousRecord.year !== earliestYear) {
      // Only interesting if we broke a record that wasn't at start of data
      const metricShort = getMetricShortName(ctx.metricId)
      return `${metricShort} at record high, surpassing ${previousRecord.year} peak`
    }
  }
  
  // Check if current is the record low
  const sortedAsc = [...values].sort((a, b) => a.value - b.value)
  if (ctx.currentValue <= sortedAsc[0].value && ctx.currentYear === sortedAsc[0].year) {
    const previousLow = sortedAsc.find(p => p.year !== ctx.currentYear)
    if (previousLow && previousLow.year !== earliestYear) {
      const metricShort = getMetricShortName(ctx.metricId)
      return `${metricShort} at record low, below ${previousLow.year} trough`
    }
  }
  
  return null
}

/**
 * Check for trend reversal (first positive/negative growth in N years)
 * "Population growing again after 6 years of decline"
 */
function checkTrendReversal(ctx: AnomalyContext): string | null {
  if (ctx.yoyGrowth === null || ctx.allYoYChanges.length < 3) return null
  
  const currentIsPositive = ctx.yoyGrowth > 0.5
  const currentIsNegative = ctx.yoyGrowth < -0.5
  
  if (!currentIsPositive && !currentIsNegative) return null
  
  // Count consecutive years of opposite sign before current
  let streak = 0
  for (let i = ctx.allYoYChanges.length - 2; i >= 0; i--) {
    const change = ctx.allYoYChanges[i].change
    if (currentIsPositive && change < 0) {
      streak++
    } else if (currentIsNegative && change > 0) {
      streak++
    } else {
      break
    }
  }
  
  // Only flag if streak was 3+ years
  if (streak >= 3) {
    const metricShort = getMetricShortName(ctx.metricId)
    if (currentIsPositive) {
      return `${metricShort} growing again after ${streak} years of decline`
    } else {
      return `${metricShort} declining after ${streak} years of growth`
    }
  }
  
  return null
}

/**
 * Check largest YoY swing in history
 * "Largest population swing since 2009"
 */
function checkVolatilitySpike(ctx: AnomalyContext): string | null {
  if (ctx.yoyGrowth === null || ctx.allYoYChanges.length < 5) return null
  
  const absCurrent = Math.abs(ctx.yoyGrowth)
  
  // Find largest historical swing
  let maxSwing = 0
  let maxSwingYear = 0
  for (let i = 0; i < ctx.allYoYChanges.length - 1; i++) {
    const absChange = Math.abs(ctx.allYoYChanges[i].change)
    if (absChange > maxSwing) {
      maxSwing = absChange
      maxSwingYear = ctx.allYoYChanges[i].year
    }
  }
  
  // Only flag if current is the largest swing AND it's significant
  if (absCurrent > maxSwing && absCurrent > 5 && maxSwingYear > 0) {
    const metricShort = getMetricShortName(ctx.metricId)
    return `Largest ${metricShort.toLowerCase()} swing since ${maxSwingYear}`
  }
  
  return null
}

/**
 * Check COVID recovery status (vs 2019 baseline)
 * "Employment still 12% below 2019 level" or "72% above pre-pandemic level"
 */
function checkCovidRecovery(ctx: AnomalyContext): string | null {
  // Only relevant for years 2021-2025
  if (ctx.currentYear < 2021 || ctx.currentYear > 2025) return null
  
  const baseline2019 = ctx.historicalData.find(d => d.year === 2019)
  if (!baseline2019) return null
  
  const changeFrom2019 = ((ctx.currentValue - baseline2019.value) / baseline2019.value) * 100
  const metricShort = getMetricShortName(ctx.metricId)
  
  // Flag significant deviations from 2019
  if (changeFrom2019 < -5) {
    return `${metricShort} still ${Math.abs(changeFrom2019).toFixed(0)}% below 2019 level`
  }
  
  if (changeFrom2019 > 10) {
    return `${metricShort} ${changeFrom2019.toFixed(0)}% above pre-pandemic level`
  }
  
  return null
}

/**
 * Check cross-metric correlations
 */
function checkCorrelations(ctx: AnomalyContext): string[] {
  const correlations: string[] = []
  if (!ctx.allMetricsData || ctx.allMetricsData.length === 0) return correlations
  
  const getMetricYoY = (metricId: string): number | null => {
    const data = ctx.allMetricsData?.find(d => d.metricId === metricId)?.data
    if (!data) return null
    return getYoY(data, ctx.year)
  }
  
  const gvaYoY = getMetricYoY("nominal_gva_mn_gbp")
  const empYoY = getMetricYoY("emp_total_jobs")
  const popYoY = getMetricYoY("population_total")
  const incYoY = getMetricYoY("gdhi_per_head_gbp")
  
  // GVA outpacing employment = productivity gains
  if (ctx.metricId === "nominal_gva_mn_gbp" && gvaYoY !== null && empYoY !== null) {
    if (gvaYoY > empYoY + 1.5) {
      correlations.push(`Output growing faster than jobs, suggesting productivity gains`)
    }
  }
  
  // Employment outpacing GVA = labour-intensive growth
  if (ctx.metricId === "emp_total_jobs" && gvaYoY !== null && empYoY !== null) {
    if (empYoY > gvaYoY + 1) {
      correlations.push(`Jobs growing faster than output, labour-intensive growth`)
    }
  }
  
  // Population outpacing employment = residential pressure
  if (ctx.metricId === "population_total" && popYoY !== null && empYoY !== null) {
    if (popYoY > empYoY + 0.5) {
      correlations.push(`Population outpacing jobs, residential pressure building`)
    }
  }
  
  // Income outpacing GVA = strong local capture
  if (ctx.metricId === "gdhi_per_head_gbp" && incYoY !== null && gvaYoY !== null) {
    if (incYoY > gvaYoY + 1) {
      correlations.push(`Income growth outpacing output, strong local capture`)
    }
    if (gvaYoY > incYoY + 2) {
      correlations.push(`Output growing faster than incomes, value may accrue elsewhere`)
    }
  }
  
  // Employment growing with population = balanced growth
  if (ctx.metricId === "emp_total_jobs" && empYoY !== null && popYoY !== null) {
    if (Math.abs(empYoY - popYoY) < 0.3 && empYoY > 0.5) {
      correlations.push(`Jobs and population growing in tandem, balanced expansion`)
    }
  }
  
  return correlations
}

// -----------------------------------------------------------------------------
// API Handler
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: MetricAnalysisRequest = await request.json()
    const {
      metricId,
      region,
      regionName,
      year,
      currentData,
      allScenariosData,
      allMetricsData,
    } = body

    const metricConfig = METRICS.find((m) => m.id === metricId)
    const metricTitle = metricConfig?.title ?? metricId

    console.log(`[Metric Analysis] ${metricId} for ${regionName}`)

    // Get latest historical value
    const historical = currentData.filter((d) => d.type === "historical").sort((a, b) => a.year - b.year)
    const latest = historical[historical.length - 1]
    const previous = historical[historical.length - 2]
    
    if (!latest) {
      return NextResponse.json({
        bullets: [],
        hasAnomalies: false,
        timestamp: new Date().toISOString(),
      } satisfies MetricAnalysisResponse)
    }

    const currentValue = latest.value
    const currentYear = latest.year
    const yoyGrowth = previous ? calculateChange(latest.value, previous.value) : null
    
    // Compute all YoY changes for temporal analysis
    const allYoYChanges: { year: number; change: number }[] = []
    for (let i = 1; i < historical.length; i++) {
      if (historical[i - 1].value !== 0) {
        allYoYChanges.push({
          year: historical[i].year,
          change: calculateChange(historical[i].value, historical[i - 1].value)
        })
      }
    }
    
    // Compute momentum
    const { momentum, recentAvg, longTermAvg } = computeMomentum(currentData)
    
    // Compute scenario divergence
    const scenarioDivergence = computeScenarioDivergence(allScenariosData)
    
    // Load percentiles
    const percentiles = loadPercentiles()
    const regionLevel = detectRegionLevel(region)
    const metricPercentiles = regionLevel ? percentiles[metricId]?.[regionLevel] ?? null : null
    
    // Build context
    const ctx: AnomalyContext = {
      metricId,
      metricTitle,
      regionCode: region,
      regionName,
      regionLevel: regionLevel ?? "unknown",
      currentValue,
      currentYear,
      yoyGrowth,
      momentum,
      recentAvg,
      longTermAvg,
      scenarioDivergence,
      percentiles: metricPercentiles,
      allMetricsData,
      year,
      historicalData: historical,
      allYoYChanges,
    }
    
    // Run anomaly checks (priority order)
    const anomalies: string[] = []
    
    // 1. NATIONAL EXTREMES FIRST (highest/lowest nationally - SUPER useful)
    const extreme = checkExtreme(ctx)
    if (extreme) anomalies.push(extreme)
    
    // 2. Historical spike/drop (like City of London surge)
    if (anomalies.length < 3) {
      const spike = checkHistoricalSpike(ctx)
      if (spike) anomalies.push(spike)
    }
    
    // 3. COVID recovery (very relevant 2021-2025)
    if (anomalies.length < 3) {
      const covid = checkCovidRecovery(ctx)
      if (covid) anomalies.push(covid)
    }
    
    // 4. Top/bottom decile nationally
    if (anomalies.length < 3) {
      const topDecile = checkTopDecile(ctx)
      if (topDecile) anomalies.push(topDecile)
    }
    
    if (anomalies.length < 3) {
      const bottomDecile = checkBottomDecile(ctx)
      if (bottomDecile) anomalies.push(bottomDecile)
    }
    
    // 5. Trend reversal
    if (anomalies.length < 3) {
      const reversal = checkTrendReversal(ctx)
      if (reversal) anomalies.push(reversal)
    }
    
    // 6. Regional record high/low (only if meaningful)
    if (anomalies.length < 3) {
      const record = checkRegionalRecord(ctx)
      if (record) anomalies.push(record)
    }
    
    // 7. Volatility spike
    if (anomalies.length < 3) {
      const volatility = checkVolatilitySpike(ctx)
      if (volatility) anomalies.push(volatility)
    }
    
    // 8. Momentum
    if (anomalies.length < 3) {
      const momentumCheck = checkMomentum(ctx)
      if (momentumCheck) anomalies.push(momentumCheck)
    }
    
    // 9. Cross-metric correlations
    if (anomalies.length < 3) {
      const correlations = checkCorrelations(ctx)
      for (const corr of correlations) {
        if (anomalies.length >= 3) break
        anomalies.push(corr)
      }
    }
    
    // 10. Scenario divergence
    if (anomalies.length < 3) {
      const divergence = checkScenarioDivergence(ctx)
      if (divergence) anomalies.push(divergence)
    }
    
    // Limit to max 3 bullets
    const bullets = anomalies.slice(0, 3)
    
    console.log(`[Metric Analysis] Found ${bullets.length} insights: ${bullets.join(", ") || "none"}`)
    
    return NextResponse.json({
      bullets,
      hasAnomalies: bullets.length > 0,
      timestamp: new Date().toISOString(),
    } satisfies MetricAnalysisResponse)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("❌ Metric analysis error:", message)

    return NextResponse.json(
      {
        bullets: [],
        hasAnomalies: false,
        timestamp: new Date().toISOString(),
      } satisfies MetricAnalysisResponse,
      { status: 500 }
    )
  }
}
