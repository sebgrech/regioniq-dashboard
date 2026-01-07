/**
 * Insight Engine
 * 
 * Computes signals and metric insights using configuration.
 * Returns IC-safe conclusions, not raw numbers.
 */

import { getMetricInsightConfig, type MetricInsightConfig } from "./metric-insights.config"
import { 
  REGION_SIGNALS, 
  ARCHETYPE_RULES, 
  type SignalConfig, 
  type SignalOutcome,
  type ArchetypeRule 
} from "./region-signals.config"
import { getPeerGroupLabel, getRegionName } from "./region-helpers"

// =============================================================================
// Types
// =============================================================================

export interface MetricDataPoint {
  year: number
  value: number
  scenario?: string
}

export interface MetricInsightResult {
  rank: {
    position: number
    total: number
    conclusion: string
  } | null
  growth: {
    value: number          // 5yr CAGR
    peerAvg: number | null
    nationalAvg: number | null
    conclusion: string
  } | null
  highlights: string[]
}

export interface SignalResult {
  id: string
  label: string
  outcome: SignalOutcome
  value: number | null     // Internal computed value
  conclusion: string       // IC-safe conclusion shown to user
  detail: string          // Detail shown on expand (e.g., "1.24 jobs per resident")
}

export interface ArchetypeResult {
  id: string
  label: string
  conclusion: string
  matchStrength: number    // 0-1, how well signals match
}

export interface InsightResponse {
  metricInsights: MetricInsightResult
  signals: SignalResult[]
  archetype: ArchetypeResult | null
  peerContext: {
    parentName: string
    peerGroupLabel: string
    peerCount: number
  }
}

// =============================================================================
// Signal Persistence (Forward-Looking)
// =============================================================================

export interface SignalPersistence {
  signalId: string
  currentOutcome: SignalOutcome
  firstChangeYear: number | null  // null = holds through horizon (2035)
  holdsIn: "baseline" | "all" | "mixed"
}

/**
 * Time series data for persistence computation
 * Keyed by metric ID, contains arrays for each scenario
 */
export interface ForecastTimeSeries {
  [metricId: string]: {
    baseline: MetricDataPoint[]
    principal?: MetricDataPoint[]
    high?: MetricDataPoint[]
    low?: MetricDataPoint[]
  }
}

// =============================================================================
// CAGR Calculation
// =============================================================================

/**
 * Calculate Compound Annual Growth Rate
 */
export function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

/**
 * Calculate 5-year CAGR from time series data
 */
export function calculate5YearCAGR(data: MetricDataPoint[], targetYear: number): number | null {
  const endPoint = data.find(d => d.year === targetYear)
  const startPoint = data.find(d => d.year === targetYear - 5)
  
  if (!endPoint || !startPoint || startPoint.value <= 0) return null
  
  return calculateCAGR(startPoint.value, endPoint.value, 5)
}

// =============================================================================
// Metric Insights
// =============================================================================

/**
 * Compute rank among peer regions
 */
export function computeRank(
  regionValue: number,
  peerValues: number[],
  config: MetricInsightConfig,
  peerGroupLabel: string
): MetricInsightResult["rank"] {
  // Include self in the ranking
  const allValues = [...peerValues, regionValue].sort((a, b) => b - a) // Descending
  const position = allValues.indexOf(regionValue) + 1
  const total = allValues.length
  
  // Determine conclusion based on position
  let conclusion: string
  const topThreshold = Math.ceil(total * 0.25)
  const bottomThreshold = Math.ceil(total * 0.75)
  
  if (position <= topThreshold) {
    conclusion = config.conclusions.rankTop.replace("{peerGroup}", peerGroupLabel)
  } else if (position >= bottomThreshold) {
    conclusion = config.conclusions.rankBottom.replace("{peerGroup}", peerGroupLabel)
  } else {
    conclusion = config.conclusions.rankMiddle.replace("{peerGroup}", peerGroupLabel)
  }
  
  return { position, total, conclusion }
}

/**
 * Compute growth comparison
 */
export function computeGrowth(
  regionGrowth: number | null,
  peerGrowths: number[],
  nationalGrowth: number | null,
  config: MetricInsightConfig
): MetricInsightResult["growth"] {
  if (regionGrowth === null) return null
  
  const validPeerGrowths = peerGrowths.filter(g => g !== null && !isNaN(g))
  const peerAvg = validPeerGrowths.length > 0 
    ? validPeerGrowths.reduce((a, b) => a + b, 0) / validPeerGrowths.length 
    : null
  
  // Determine conclusion
  let conclusion: string
  const { strong, weak } = config.interpretation.growthThresholds
  
  if (regionGrowth < 0) {
    conclusion = config.conclusions.growthNegative.replace("{rate}", Math.abs(regionGrowth).toFixed(1))
  } else if (regionGrowth >= strong) {
    conclusion = config.conclusions.growthStrong.replace("{rate}", regionGrowth.toFixed(1))
  } else if (regionGrowth <= weak) {
    conclusion = config.conclusions.growthWeak.replace("{rate}", regionGrowth.toFixed(1))
  } else {
    conclusion = `Growing at ${regionGrowth.toFixed(1)}% annually`
  }
  
  return {
    value: regionGrowth,
    peerAvg,
    nationalAvg: nationalGrowth,
    conclusion
  }
}

/**
 * Generate highlight conclusions
 */
export function generateHighlights(
  metricId: string,
  config: MetricInsightConfig,
  rank: MetricInsightResult["rank"],
  growth: MetricInsightResult["growth"],
  nationalAvg: number | null,
  regionValue: number
): string[] {
  const highlights: string[] = []
  
  // Rank-based highlight (if in top 3)
  if (rank && rank.position <= 3 && rank.total >= 5) {
    highlights.push(rank.conclusion)
  }
  
  // Growth comparison to peers
  if (growth && growth.peerAvg !== null) {
    const diff = growth.value - growth.peerAvg
    if (Math.abs(diff) >= 0.5) {
      if (diff > 0) {
        highlights.push(`Growing ${diff.toFixed(1)}pp faster than peer average`)
      } else {
        highlights.push(`Growing ${Math.abs(diff).toFixed(1)}pp slower than peer average`)
      }
    }
  }
  
  // National comparison
  if (nationalAvg !== null && regionValue > 0) {
    const pctDiff = ((regionValue - nationalAvg) / nationalAvg) * 100
    if (pctDiff > 10) {
      highlights.push(config.conclusions.aboveNational)
    } else if (pctDiff < -10) {
      highlights.push(config.conclusions.belowNational)
    }
  }
  
  return highlights.slice(0, 3) // Max 3 highlights
}

/**
 * Main function: Compute metric insights
 */
export function computeMetricInsights(
  metricId: string,
  regionData: MetricDataPoint[],
  peerData: Map<string, MetricDataPoint[]>,
  nationalData: MetricDataPoint[],
  year: number,
  regionCode: string
): MetricInsightResult {
  const config = getMetricInsightConfig(metricId)
  const peerGroupLabel = getPeerGroupLabel(regionCode)
  
  // Get current values
  const regionValue = regionData.find(d => d.year === year)?.value ?? 0
  const nationalValue = nationalData.find(d => d.year === year)?.value ?? null
  
  const peerCurrentValues: number[] = []
  peerData.forEach((data) => {
    const val = data.find(d => d.year === year)?.value
    if (val !== undefined) peerCurrentValues.push(val)
  })
  
  // Compute rank
  const rank = computeRank(regionValue, peerCurrentValues, config, peerGroupLabel)
  
  // Compute growth (5yr CAGR)
  const regionGrowth = calculate5YearCAGR(regionData, year)
  const nationalGrowth = calculate5YearCAGR(nationalData, year)
  
  const peerGrowths: number[] = []
  peerData.forEach((data) => {
    const g = calculate5YearCAGR(data, year)
    if (g !== null) peerGrowths.push(g)
  })
  
  const growth = computeGrowth(regionGrowth, peerGrowths, nationalGrowth, config)
  
  // Generate highlights
  const highlights = generateHighlights(
    metricId, 
    config, 
    rank, 
    growth, 
    nationalValue, 
    regionValue
  )
  
  return { rank, growth, highlights }
}

// =============================================================================
// Signal Computation
// =============================================================================

interface MetricValues {
  [metricId: string]: {
    current: number | null
    growth5yr: number | null
  }
}

/**
 * Compute a single signal from metric values
 */
export function computeSignal(
  config: SignalConfig,
  metrics: MetricValues
): SignalResult {
  let value: number | null = null
  let outcome: SignalOutcome = "neutral"
  let detail = config.detail
  
  switch (config.computation.type) {
    case "ratio": {
      // Compute ratio of metrics
      if (config.id === "employment_density") {
        const jobs = metrics["emp_total_jobs"]?.current
        const pop16_64 = metrics["population_16_64"]?.current
        if (jobs && pop16_64 && pop16_64 > 0) {
          value = jobs / pop16_64
          detail = detail.replace("{value}", value.toFixed(2))
          
          // Check for extreme employment hubs first (City of London, Westminster, etc.)
          if (config.thresholds.extreme && value >= config.thresholds.extreme) {
            outcome = "extreme"
          } else if (value >= (config.thresholds.high ?? 1.0)) {
            outcome = "high"
          } else if (value <= (config.thresholds.low ?? 0.8)) {
            outcome = "low"
          } else {
            outcome = "neutral"
          }
        }
      } else if (config.id === "income_capture") {
        const gdhi = metrics["gdhi_per_head_gbp"]?.current
        const gva = metrics["nominal_gva_mn_gbp"]?.current
        const pop = metrics["population_total"]?.current
        if (gdhi && gva && pop && pop > 0) {
          const gvaPerCapita = (gva * 1_000_000) / pop
          value = gvaPerCapita > 0 ? gdhi / gvaPerCapita : null
          if (value !== null) {
            detail = detail.replace("{value}", (value * 100).toFixed(0))
            
            // Check for extreme values first (affluent suburbs or major output centres)
            if (config.thresholds.extreme_high && value >= config.thresholds.extreme_high) {
              outcome = "extreme_high"
            } else if (config.thresholds.extreme_low && value <= config.thresholds.extreme_low) {
              outcome = "extreme_low"
            } else if (value >= (config.thresholds.high ?? 0.7)) {
              outcome = "high"
            } else if (value <= (config.thresholds.low ?? 0.5)) {
              outcome = "low"
            } else {
              outcome = "neutral"
            }
          }
        }
      } else if (config.id === "productivity_strength") {
        const gva = metrics["nominal_gva_mn_gbp"]?.current
        const jobs = metrics["emp_total_jobs"]?.current
        if (gva && jobs && jobs > 0) {
          value = (gva * 1_000_000) / jobs
          detail = detail.replace("{value}", Math.round(value).toLocaleString())
          
          // Check for extreme productivity first (finance, oil & gas, pharma clusters)
          if (config.thresholds.extreme && value >= config.thresholds.extreme) {
            outcome = "extreme"
          } else if (value >= (config.thresholds.high ?? 70000)) {
            outcome = "high"
          } else if (value <= (config.thresholds.low ?? 45000)) {
            outcome = "low"
          } else {
            outcome = "neutral"
          }
        }
      }
      break
    }
    
    case "rate_divergence": {
      // Labour capacity: employment rate vs unemployment pattern
      if (config.id === "labour_capacity") {
        const empRate = metrics["employment_rate_pct"]?.current
        const unempRate = metrics["unemployment_rate_pct"]?.current
        
        // Handle missing data gracefully
        if (empRate === null || empRate === undefined) {
          // No employment rate data for this region (common for small LADs)
          detail = "Employment rate data not available for this region"
          outcome = "neutral"
          value = null
        } else if (unempRate === null || unempRate === undefined) {
          // Only employment rate available
          detail = `Employment rate ${empRate.toFixed(1)}%`
          value = empRate
          if (empRate >= (config.thresholds.high ?? 76)) {
            outcome = "high"
          } else if (empRate <= (config.thresholds.low ?? 72)) {
            outcome = "low"
          } else {
            outcome = "neutral"
          }
        } else {
          // Both metrics available
          value = empRate
          detail = detail
            .replace("{empRate}", empRate.toFixed(1))
            .replace("{unempRate}", unempRate.toFixed(1))
          
          // High employment + low unemployment = tight
          if (empRate >= (config.thresholds.high ?? 76)) {
            outcome = "high"
          } else if (empRate <= (config.thresholds.low ?? 72)) {
            outcome = "low"
          } else {
            outcome = "neutral"
          }
        }
      }
      break
    }
    
    case "growth_comparison": {
      // Compare growth rates of multiple metrics
      if (config.id === "growth_composition") {
        const popGrowth = metrics["population_total"]?.growth5yr
        const empGrowth = metrics["emp_total_jobs"]?.growth5yr
        const gvaGrowth = metrics["nominal_gva_mn_gbp"]?.growth5yr
        
        detail = detail
          .replace("{popGrowth}", popGrowth?.toFixed(1) ?? "N/A")
          .replace("{empGrowth}", empGrowth?.toFixed(1) ?? "N/A")
          .replace("{gvaGrowth}", gvaGrowth?.toFixed(1) ?? "N/A")
        
        if (empGrowth !== null && popGrowth !== null) {
          const diff = empGrowth - popGrowth
          value = diff
          
          if (diff >= (config.thresholds.high ?? 1.0)) {
            outcome = "high" // Jobs outpacing population
          } else if (diff <= (config.thresholds.low ?? -1.0)) {
            outcome = "low" // Population outpacing jobs
          } else {
            outcome = "neutral"
          }
        }
      }
      break
    }
  }
  
  // Get conclusion from config
  const conclusion = config.conclusions[outcome] ?? config.conclusions.neutral ?? ""
  
  return {
    id: config.id,
    label: config.label,
    outcome,
    value,
    conclusion,
    detail
  }
}

/**
 * Compute all signals for a region
 */
export function computeAllSignals(metrics: MetricValues): SignalResult[] {
  return REGION_SIGNALS.map(config => computeSignal(config, metrics))
    .filter(signal => signal.conclusion !== "") // Only return signals with valid conclusions
}

// =============================================================================
// Signal Persistence (Forward-Looking)
// =============================================================================

const HORIZON_YEAR = 2035

/**
 * Build MetricValues for a specific year from forecast time series
 */
function buildMetricsForYear(
  forecastData: ForecastTimeSeries,
  targetYear: number,
  scenario: "baseline" | "principal" | "high" | "low"
): MetricValues {
  const metrics: MetricValues = {}
  
  for (const [metricId, scenarioData] of Object.entries(forecastData)) {
    const series = scenarioData[scenario] ?? scenarioData.baseline
    if (!series) continue
    
    const currentPoint = series.find(d => d.year === targetYear)
    const fiveYearsAgo = series.find(d => d.year === targetYear - 5)
    
    let growth5yr: number | null = null
    if (currentPoint && fiveYearsAgo && fiveYearsAgo.value > 0) {
      growth5yr = (Math.pow(currentPoint.value / fiveYearsAgo.value, 1/5) - 1) * 100
    }
    
    metrics[metricId] = {
      current: currentPoint?.value ?? null,
      growth5yr
    }
  }
  
  return metrics
}

/**
 * Compute when a signal outcome first changes
 * Returns null if outcome holds through horizon year
 */
function findFirstChangeYear(
  signalId: string,
  currentOutcome: SignalOutcome,
  forecastData: ForecastTimeSeries,
  baseYear: number,
  scenario: "baseline" | "principal" | "high" | "low"
): number | null {
  const config = REGION_SIGNALS.find(s => s.id === signalId)
  if (!config) return null
  
  // Check each year from baseYear+1 to horizon
  for (let year = baseYear + 1; year <= HORIZON_YEAR; year++) {
    const metricsForYear = buildMetricsForYear(forecastData, year, scenario)
    const signal = computeSignal(config, metricsForYear)
    
    if (signal.outcome !== currentOutcome) {
      return year
    }
  }
  
  return null // Holds through horizon
}

/**
 * Compute signal persistence across scenarios
 * 
 * This is the key function for forward-looking intelligence:
 * - Re-evaluates the same signal with same thresholds over time
 * - Checks baseline scenario first, then others
 * - Returns when signal first changes and scenario robustness
 */
export function computeSignalPersistence(
  signalId: string,
  currentOutcome: SignalOutcome,
  forecastData: ForecastTimeSeries,
  baseYear: number
): SignalPersistence {
  // Check baseline scenario first
  const baselineChangeYear = findFirstChangeYear(
    signalId,
    currentOutcome,
    forecastData,
    baseYear,
    "baseline"
  )
  
  // Check other scenarios if available
  const scenarios: ("principal" | "high" | "low")[] = ["principal", "high", "low"]
  const availableScenarios = scenarios.filter(s => {
    // Check if at least one metric has this scenario
    return Object.values(forecastData).some(d => d[s] && d[s]!.length > 0)
  })
  
  if (availableScenarios.length === 0) {
    // Only baseline available
    return {
      signalId,
      currentOutcome,
      firstChangeYear: baselineChangeYear,
      holdsIn: "baseline"
    }
  }
  
  // Check if outcome holds in all scenarios
  const otherChangeYears = availableScenarios.map(scenario => 
    findFirstChangeYear(signalId, currentOutcome, forecastData, baseYear, scenario)
  )
  
  // Determine holdsIn status
  const allHoldThrough = baselineChangeYear === null && 
    otherChangeYears.every(y => y === null)
  
  const noneHold = baselineChangeYear !== null && 
    otherChangeYears.every(y => y !== null)
  
  let holdsIn: "baseline" | "all" | "mixed"
  if (allHoldThrough) {
    holdsIn = "all"
  } else if (baselineChangeYear === null && otherChangeYears.some(y => y !== null)) {
    holdsIn = "baseline" // Holds in baseline but not all scenarios
  } else if (noneHold) {
    // Find earliest change year across all scenarios
    const allChangeYears = [baselineChangeYear, ...otherChangeYears].filter(y => y !== null) as number[]
    const minYear = Math.min(...allChangeYears)
    const maxYear = Math.max(...allChangeYears)
    
    // If change years vary significantly, it's mixed
    holdsIn = (maxYear - minYear) > 2 ? "mixed" : "all"
  } else {
    holdsIn = "mixed"
  }
  
  return {
    signalId,
    currentOutcome,
    firstChangeYear: baselineChangeYear,
    holdsIn
  }
}

/**
 * Format persistence as a temporal suffix for the verdict
 * 
 * IC-DEFENSIBLE RULES (no predictions, no hedging):
 * - Holds in ALL scenarios through horizon → " through 2035" (fully robust)
 * - Holds in baseline only through horizon → " through 2035 under baseline conditions"
 * - Changes within 5 years in ANY scenario → NO SUFFIX (silence > false precision)
 * - Changes 6+ years out, robust → " through {year}" 
 * - Changes 6+ years out, baseline only → " through {year} under baseline conditions"
 * - Mixed/uncertain → NO SUFFIX (silence > hedging)
 * 
 * NEVER USE: "expected to shift", "may change", "likely to" — these are predictions
 */
export function formatPersistenceSuffix(
  persistence: SignalPersistence | null,
  baseYear: number
): string {
  if (!persistence) return ""
  
  const { firstChangeYear, holdsIn } = persistence
  
  // Mixed scenarios → silence is more credible than hedging
  if (holdsIn === "mixed") {
    return ""
  }
  
  // Changes soon (within 5 years) in any scenario → stay silent
  // Rationale: near-term projections have wide confidence intervals,
  // stating a specific year implies false precision
  if (firstChangeYear !== null) {
    const yearsUntilChange = firstChangeYear - baseYear
    if (yearsUntilChange <= 5) {
      return "" // Silence > "expected to shift by X"
    }
  }
  
  // Holds through horizon (2035)
  if (firstChangeYear === null) {
    if (holdsIn === "all") {
      return " through 2035"
    } else {
      return " through 2035 under baseline conditions"
    }
  }
  
  // Changes later (6+ years out) — safe to state horizon year
  if (holdsIn === "all") {
    return ` through ${firstChangeYear - 1}`
  } else {
    return ` through ${firstChangeYear - 1} under baseline conditions`
  }
}

// =============================================================================
// Archetype Derivation
// =============================================================================

/**
 * Derive archetype from signal outcomes
 */
export function deriveArchetype(signals: SignalResult[]): ArchetypeResult | null {
  const signalMap = new Map(signals.map(s => [s.id, s.outcome]))
  
  for (const rule of ARCHETYPE_RULES) {
    // Check if all required signals match
    const requiredMatch = rule.requiredSignals.every(
      req => signalMap.get(req.signalId) === req.outcome
    )
    
    if (requiredMatch) {
      // Count optional matches for strength
      let optionalMatches = 0
      const optionalTotal = rule.optionalSignals?.length ?? 0
      
      rule.optionalSignals?.forEach(opt => {
        if (signalMap.get(opt.signalId) === opt.outcome) {
          optionalMatches++
        }
      })
      
      const matchStrength = optionalTotal > 0 
        ? (rule.requiredSignals.length + optionalMatches) / (rule.requiredSignals.length + optionalTotal)
        : 1.0
      
      return {
        id: rule.id,
        label: rule.label,
        conclusion: rule.conclusion,
        matchStrength
      }
    }
  }
  
  // Return balanced economy as fallback
  const balanced = ARCHETYPE_RULES.find(r => r.id === "balanced_economy")
  return balanced ? {
    id: balanced.id,
    label: balanced.label,
    conclusion: balanced.conclusion,
    matchStrength: 0.5
  } : null
}

// =============================================================================
// Main Entry Point
// =============================================================================

export interface ComputeInsightsParams {
  metricId: string
  regionCode: string
  year: number
  regionData: MetricDataPoint[]
  peerData: Map<string, MetricDataPoint[]>
  nationalData: MetricDataPoint[]
  allMetricsData: MetricValues
  parentName: string
  peerCount: number
}

/**
 * Compute full insights response
 */
export function computeInsights(params: ComputeInsightsParams): InsightResponse {
  const {
    metricId,
    regionCode,
    year,
    regionData,
    peerData,
    nationalData,
    allMetricsData,
    parentName,
    peerCount
  } = params
  
  // Compute metric-specific insights
  const metricInsights = computeMetricInsights(
    metricId,
    regionData,
    peerData,
    nationalData,
    year,
    regionCode
  )
  
  // Compute signals
  const signals = computeAllSignals(allMetricsData)
  
  // Derive archetype
  const archetype = deriveArchetype(signals)
  
  return {
    metricInsights,
    signals,
    archetype,
    peerContext: {
      parentName,
      peerGroupLabel: getPeerGroupLabel(regionCode),
      peerCount
    }
  }
}

