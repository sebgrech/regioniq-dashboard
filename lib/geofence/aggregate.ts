/**
 * Geofence Aggregation
 * 
 * Fetches region-level metric data from Supabase and aggregates
 * values based on intersection weights. Supports both LAD and MSOA levels.
 */

import { supabase } from "@/lib/supabase"
import type { Scenario } from "@/lib/metrics.config"
import type {
  RegionWeight,
  RegionContribution,
  GeofenceResult,
  Geofence,
  CatchmentLevel,
} from "./types"
import { calculateGeofenceWeights } from "./calculate"

// ---------------------------------------------------------------------------
// Metric configuration per level
// ---------------------------------------------------------------------------

const TABLE_MAP: Record<CatchmentLevel, string> = {
  LAD: "lad_latest_all",
  MSOA: "msoa_latest_all",
}

const AGGREGATION_METRICS: Record<
  CatchmentLevel,
  Record<string, string>
> = {
  LAD: {
    population: "population_total",
    gdhi: "gdhi_per_head_gbp",
    employment: "emp_total_jobs",
  },
  MSOA: {
    population: "population_total",
    employment: "emp_total_jobs",
    gva: "nominal_gva_mn_gbp",
    income: "disposable_income_gbp",
  },
}

// ---------------------------------------------------------------------------
// Raw metric values from Supabase
// ---------------------------------------------------------------------------

interface RegionMetricValues {
  population: number | null
  gdhi_per_head: number | null // LAD only
  employment: number | null
  gva: number | null // MSOA only
  income: number | null // MSOA only
}

// ---------------------------------------------------------------------------
// Fetch metrics
// ---------------------------------------------------------------------------

/**
 * Fetch metric values for a list of region codes from Supabase.
 * Queries the appropriate table based on catchment level.
 */
async function fetchMetrics(
  codes: string[],
  level: CatchmentLevel,
  year: number,
  scenario: Scenario
): Promise<Map<string, RegionMetricValues>> {
  const results = new Map<string, RegionMetricValues>()

  if (codes.length === 0) return results

  // Initialise all regions with null values
  for (const code of codes) {
    results.set(code, {
      population: null,
      gdhi_per_head: null,
      employment: null,
      gva: null,
      income: null,
    })
  }

  const table = TABLE_MAP[level]
  const metricIds = Object.values(AGGREGATION_METRICS[level])

  try {
    let data: any[] | null = null

    if (level === "MSOA") {
      // MSOA metrics have different latest years per metric.
      // Fetch all rows for the requested codes (without period filter),
      // then take the latest period per (region_code, metric_id).
      const { data: rows, error } = await supabase
        .from(table)
        .select("region_code, metric_id, period, value, ci_lower, ci_upper, data_type")
        .in("region_code", codes)
        .in("metric_id", metricIds)
        .order("period", { ascending: false })

      if (error) {
        console.error("[Geofence] Supabase query error:", error)
        throw new Error(`Failed to fetch ${level} metrics: ${error.message}`)
      }

      // Deduplicate: keep only the latest period per (region_code, metric_id)
      const seen = new Set<string>()
      data = (rows ?? []).filter((row: any) => {
        const key = `${row.region_code}::${row.metric_id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } else {
      // LAD: single period query (existing behaviour)
      const { data: rows, error } = await supabase
        .from(table)
        .select("region_code, metric_id, value, ci_lower, ci_upper, data_type")
        .in("region_code", codes)
        .eq("period", year)
        .in("metric_id", metricIds)

      if (error) {
        console.error("[Geofence] Supabase query error:", error)
        throw new Error(`Failed to fetch ${level} metrics: ${error.message}`)
      }

      data = rows ?? []
    }

    if (!data || data.length === 0) {
      console.warn(
        `[Geofence] No metric data found for ${level} regions:`,
        codes.slice(0, 5)
      )
      return results
    }

    const metrics = AGGREGATION_METRICS[level]

    // Process results
    for (const row of data) {
      const regionValues = results.get(row.region_code)
      if (!regionValues) continue

      // Select appropriate value based on data type and scenario
      let value: number | null = null
      if (row.data_type === "historical") {
        value = row.value
      } else {
        switch (scenario) {
          case "baseline":
            value = row.value
            break
          case "downside":
            value = row.ci_lower ?? row.value
            break
          case "upside":
            value = row.ci_upper ?? row.value
            break
          default:
            value = row.value
        }
      }

      // Map metric_id to the appropriate field
      if (row.metric_id === metrics.population) {
        regionValues.population = value
      } else if (level === "LAD" && row.metric_id === metrics.gdhi) {
        regionValues.gdhi_per_head = value
      } else if (row.metric_id === metrics.employment) {
        regionValues.employment = value
      } else if (level === "MSOA" && row.metric_id === metrics.gva) {
        regionValues.gva = value
      } else if (level === "MSOA" && row.metric_id === metrics.income) {
        regionValues.income = value
      }
    }

    console.log(
      `[Geofence] Fetched metrics for ${results.size} ${level} regions, ${data.length} data points`
    )
    return results
  } catch (error) {
    console.error(`[Geofence] Error fetching ${level} metrics:`, error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface AggregationResult {
  totals: {
    population: number
    gdhi_total: number
    employment: number
    gva: number
    average_income: number
  }
  breakdown: RegionContribution[]
}

/**
 * Aggregate region metrics using intersection weights.
 *
 * - Population, employment, GVA: sum(value x weight)
 * - LAD GDHI: sum(gdhi_per_head x population x weight) to get total GDHI
 * - MSOA income: population-weighted average (NOT a sum):
 *     sum(income x population x weight) / sum(population x weight)
 */
function aggregateMetrics(
  weights: RegionWeight[],
  metrics: Map<string, RegionMetricValues>,
  level: CatchmentLevel
): AggregationResult {
  let totalPopulation = 0
  let totalGdhi = 0
  let totalEmployment = 0
  let totalGva = 0
  // Accumulators for population-weighted average income (MSOA)
  let incomeNumerator = 0
  let incomeDenominator = 0

  const breakdown: RegionContribution[] = []

  for (const region of weights) {
    const values = metrics.get(region.code)
    if (!values) continue

    // Calculate weighted contributions
    const populationContrib = (values.population ?? 0) * region.weight
    const employmentContrib = (values.employment ?? 0) * region.weight

    let gdhiContrib = 0
    let gvaContrib = 0
    const incomeRaw = values.income ?? 0

    if (level === "LAD") {
      // LAD: GDHI total = gdhi_per_head x population x weight
      gdhiContrib =
        (values.gdhi_per_head ?? 0) * (values.population ?? 0) * region.weight
    } else {
      // MSOA: GVA is in millions, weight it
      gvaContrib = (values.gva ?? 0) * region.weight
      // Income: accumulate for population-weighted average
      if (values.income != null && values.population != null) {
        incomeNumerator += values.income * values.population * region.weight
        incomeDenominator += values.population * region.weight
      }
    }

    totalPopulation += populationContrib
    totalGdhi += gdhiContrib
    totalEmployment += employmentContrib
    totalGva += gvaContrib

    breakdown.push({
      ...region,
      population: populationContrib,
      gdhi: gdhiContrib,
      employment: employmentContrib,
      gva: gvaContrib,
      income: incomeRaw,
    })
  }

  const averageIncome =
    incomeDenominator > 0 ? incomeNumerator / incomeDenominator : 0

  return {
    totals: {
      population: Math.round(totalPopulation),
      gdhi_total: Math.round(totalGdhi),
      employment: Math.round(totalEmployment),
      gva: Math.round(totalGva * 100) / 100, // keep 2dp for millions
      average_income: Math.round(averageIncome),
    },
    breakdown,
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Calculate geofence aggregation result.
 *
 * Main entry point for geofence calculation. Takes a geofence polygon,
 * calculates intersection weights with regions, fetches metric data,
 * and returns aggregated results.
 */
export async function calculateGeofenceResult(
  geofence: Geofence,
  year: number,
  scenario: Scenario,
  level: CatchmentLevel = "LAD"
): Promise<GeofenceResult> {
  const startTime = performance.now()

  // Step 1: Calculate intersection weights
  let weights = await calculateGeofenceWeights(geofence, level)
  let effectiveLevel = level
  let fallbackReason: string | undefined

  // Scotland/NI fallback: MSOA only covers England & Wales.
  // If zero features intersect, auto-fallback to LAD.
  if (level === "MSOA" && weights.length === 0) {
    console.log(
      "[Geofence] No MSOA features intersect — falling back to LAD (likely Scotland/NI)"
    )
    weights = await calculateGeofenceWeights(geofence, "LAD")
    effectiveLevel = "LAD"
    fallbackReason =
      "Neighbourhood-level data covers England & Wales only. Showing district-level estimates for this area."
  }

  if (weights.length === 0) {
    return {
      level: effectiveLevel,
      population: 0,
      gdhi_total: 0,
      employment: 0,
      gva: 0,
      average_income: 0,
      regions_used: 0,
      year,
      scenario,
      breakdown: [],
      fallbackReason,
    }
  }

  // Step 2: Fetch region metrics from Supabase
  const regionCodes = weights.map((w) => w.code)
  const metrics = await fetchMetrics(regionCodes, effectiveLevel, year, scenario)

  // Step 3: Aggregate metrics
  const { totals, breakdown } = aggregateMetrics(weights, metrics, effectiveLevel)

  const elapsed = performance.now() - startTime
  const levelLabel = effectiveLevel === "MSOA" ? "MSOAs" : "LADs"
  console.log(
    `[Geofence] Calculation complete in ${elapsed.toFixed(0)}ms: ` +
      `${breakdown.length} ${levelLabel}, pop=${totals.population.toLocaleString()}, ` +
      (effectiveLevel === "LAD"
        ? `gdhi=\u00A3${(totals.gdhi_total / 1e9).toFixed(2)}B, `
        : `gva=\u00A3${totals.gva.toFixed(1)}M, avg_income=\u00A3${totals.average_income.toLocaleString()}, `) +
      `jobs=${totals.employment.toLocaleString()}`
  )

  return {
    level: effectiveLevel,
    ...totals,
    regions_used: breakdown.length,
    year,
    scenario,
    breakdown,
    fallbackReason,
  }
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

/**
 * Format a GeofenceResult for display.
 */
export function formatGeofenceResult(result: GeofenceResult): {
  population: string
  gdhi: string
  employment: string
  regions: string
  gva: string
  income: string
} {
  const formatNumber = (n: number): string => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toLocaleString()
  }

  const regionLabel =
    result.level === "MSOA" ? "neighbourhoods" : "local authorities"

  return {
    population: `${formatNumber(result.population)} people`,
    gdhi: `\u00A3${formatNumber(result.gdhi_total)}`,
    employment: `${formatNumber(result.employment)} jobs`,
    regions: `${result.regions_used} ${regionLabel}`,
    gva: `\u00A3${formatNumber(result.gva * 1e6)}`, // gva stored in millions
    income: `\u00A3${formatNumber(result.average_income)}`,
  }
}
