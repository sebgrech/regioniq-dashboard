/**
 * Geofence Aggregation
 * 
 * Fetches LAD-level metric data from Supabase and aggregates
 * values based on intersection weights.
 */

import { supabase } from "@/lib/supabase"
import type { Scenario } from "@/lib/metrics.config"
import type { LADWeight, LADContribution, GeofenceResult, Geofence } from "./types"
import { calculateGeofenceWeights } from "./calculate"

/** Metrics to aggregate for geofence results */
const AGGREGATION_METRICS = {
  population: "population_total",
  gdhi: "gdhi_per_head_gbp", // Note: This is per-head, so we need population to get total
  employment: "emp_total_jobs",
} as const

/** Raw metric values from Supabase for a single LAD */
interface LADMetricValues {
  population: number | null
  gdhi_per_head: number | null
  employment: number | null
}

/**
 * Fetch metric values for a list of LAD codes from Supabase.
 * 
 * @param ladCodes - Array of LAD codes to fetch
 * @param year - Data year
 * @param scenario - Scenario for forecast data
 */
async function fetchLADMetrics(
  ladCodes: string[],
  year: number,
  scenario: Scenario
): Promise<Map<string, LADMetricValues>> {
  const results = new Map<string, LADMetricValues>()

  if (ladCodes.length === 0) {
    return results
  }

  // Initialize all LADs with null values
  for (const code of ladCodes) {
    results.set(code, {
      population: null,
      gdhi_per_head: null,
      employment: null,
    })
  }

  try {
    // Fetch all metrics in a single query
    const { data, error } = await supabase
      .from("lad_latest_all")
      .select("region_code, metric_id, value, ci_lower, ci_upper, data_type")
      .in("region_code", ladCodes)
      .eq("period", year)
      .in("metric_id", Object.values(AGGREGATION_METRICS))

    if (error) {
      console.error("[Geofence] Supabase query error:", error)
      throw new Error(`Failed to fetch LAD metrics: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.warn("[Geofence] No metric data found for LADs:", ladCodes.slice(0, 5))
      return results
    }

    // Process results
    for (const row of data) {
      const ladValues = results.get(row.region_code)
      if (!ladValues) continue

      // Select appropriate value based on data type and scenario
      let value: number | null = null
      if (row.data_type === "historical") {
        value = row.value
      } else {
        // Forecast data: use scenario-specific column
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
      if (row.metric_id === AGGREGATION_METRICS.population) {
        ladValues.population = value
      } else if (row.metric_id === AGGREGATION_METRICS.gdhi) {
        ladValues.gdhi_per_head = value
      } else if (row.metric_id === AGGREGATION_METRICS.employment) {
        ladValues.employment = value
      }
    }

    console.log(`[Geofence] Fetched metrics for ${results.size} LADs, ${data.length} data points`)
    return results
  } catch (error) {
    console.error("[Geofence] Error fetching LAD metrics:", error)
    throw error
  }
}

/**
 * Aggregate LAD metrics using intersection weights.
 * 
 * For population and employment: sum(value × weight)
 * For GDHI: This is per-head income, so we calculate total GDHI as:
 *   sum(gdhi_per_head × population × weight)
 * 
 * @param weights - LAD intersection weights
 * @param metrics - LAD metric values from Supabase
 */
function aggregateMetrics(
  weights: LADWeight[],
  metrics: Map<string, LADMetricValues>
): { totals: { population: number; gdhi_total: number; employment: number }; breakdown: LADContribution[] } {
  let totalPopulation = 0
  let totalGdhi = 0
  let totalEmployment = 0
  const breakdown: LADContribution[] = []

  for (const lad of weights) {
    const values = metrics.get(lad.code)
    if (!values) continue

    // Calculate weighted contributions
    const populationContrib = (values.population ?? 0) * lad.weight
    const employmentContrib = (values.employment ?? 0) * lad.weight
    
    // GDHI total = gdhi_per_head × population × weight
    // This gives total household income for the weighted population
    const gdhiContrib = (values.gdhi_per_head ?? 0) * (values.population ?? 0) * lad.weight

    totalPopulation += populationContrib
    totalGdhi += gdhiContrib
    totalEmployment += employmentContrib

    breakdown.push({
      ...lad,
      population: populationContrib,
      gdhi: gdhiContrib,
      employment: employmentContrib,
    })
  }

  return {
    totals: {
      population: Math.round(totalPopulation),
      gdhi_total: Math.round(totalGdhi),
      employment: Math.round(totalEmployment),
    },
    breakdown,
  }
}

/**
 * Calculate geofence aggregation result.
 * 
 * Main entry point for geofence calculation. Takes a geofence polygon,
 * calculates intersection weights with LADs, fetches metric data,
 * and returns aggregated results.
 * 
 * @param geofence - The user-drawn geofence
 * @param year - Data year
 * @param scenario - Scenario for forecast data
 */
export async function calculateGeofenceResult(
  geofence: Geofence,
  year: number,
  scenario: Scenario
): Promise<GeofenceResult> {
  const startTime = performance.now()

  // Step 1: Calculate intersection weights
  const weights = await calculateGeofenceWeights(geofence)

  if (weights.length === 0) {
    return {
      population: 0,
      gdhi_total: 0,
      employment: 0,
      regions_used: 0,
      year,
      scenario,
      breakdown: [],
    }
  }

  // Step 2: Fetch LAD metrics from Supabase
  const ladCodes = weights.map((w) => w.code)
  const metrics = await fetchLADMetrics(ladCodes, year, scenario)

  // Step 3: Aggregate metrics
  const { totals, breakdown } = aggregateMetrics(weights, metrics)

  const elapsed = performance.now() - startTime
  console.log(
    `[Geofence] Calculation complete in ${elapsed.toFixed(0)}ms: ` +
    `${breakdown.length} LADs, pop=${totals.population.toLocaleString()}, ` +
    `gdhi=£${(totals.gdhi_total / 1e9).toFixed(2)}B, jobs=${totals.employment.toLocaleString()}`
  )

  return {
    ...totals,
    regions_used: breakdown.length,
    year,
    scenario,
    breakdown,
  }
}

/**
 * Format a GeofenceResult for display.
 */
export function formatGeofenceResult(result: GeofenceResult): {
  population: string
  gdhi: string
  employment: string
  regions: string
} {
  const formatNumber = (n: number): string => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
    return n.toLocaleString()
  }

  return {
    population: `${formatNumber(result.population)} people`,
    gdhi: `£${formatNumber(result.gdhi_total)}`,
    employment: `${formatNumber(result.employment)} jobs`,
    regions: `${result.regions_used} local authorities`,
  }
}

