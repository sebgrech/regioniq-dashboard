/**
 * Region Insights API
 * 
 * Place-centric analysis that answers 3 canonical questions:
 * 1. What kind of place is this economically?
 * 2. Where is the pressure or slack?
 * 3. What matters for decisions here?
 * 
 * Returns IC-safe conclusions with max 3 implications (Rule 3).
 * Now includes UI block for visual panel rendering.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { REGIONS, getDbRegionCode, type Scenario } from "@/lib/metrics.config"
import { 
  computeAllSignals,
  deriveArchetype,
  calculate5YearCAGR,
  computeSignalPersistence,
  formatPersistenceSuffix,
  type MetricDataPoint,
  type SignalResult,
  type ForecastTimeSeries,
  type SignalPersistence
} from "@/lib/insights/insight-engine"
import { deriveImplications, type SignalResult as ImplicationSignalResult } from "@/lib/insights/decision-implications"

// =============================================================================
// Request Schema (place-centric, no metricId required)
// =============================================================================

const RequestSchema = z.object({
  regionCode: z.string().min(1),
  year: z.number().int().min(1990).max(2050),
  scenario: z.enum(["baseline", "upside", "downside"]).default("baseline"),
})

// =============================================================================
// Response Types
// =============================================================================

type VerdictVisualType = "boundary" | "outputVsJobs" | "workforceSlack" | "weekdayPull"

interface SignalForUI {
  id: string
  label: string
  outcome: "high" | "low" | "neutral" | "rising" | "falling"
  strength: 1 | 2 | 3  // for ●●○ display
  detail: string       // short detail on expand (max 60 chars)
  robustness: "all" | "baseline" | "mixed"  // scenario stability indicator
}

interface UIBlock {
  bucketLabel?: string
  dominantSignalId: string
  verdictSentence: string
  verdictVisual: { type: VerdictVisualType; payload?: Record<string, unknown> }
  icCopyText: string
  signals: SignalForUI[]
}

interface PlaceInsightsResponse {
  placeCharacter: {
    conclusions: string[]
    archetype: { label: string } | null
  }
  pressureAndSlack: {
    conclusions: string[]
  }
  implications: {
    id: string
    text: string
    relevantFor: string[]
  }[]
  ui: UIBlock
}

// =============================================================================
// Data Fetching Helpers
// =============================================================================

function getTableName(regionCode: string): string {
  const region = REGIONS.find(r => r.code === regionCode)
  const level = region?.level || "ITL1"
  
  switch(level) {
    case "ITL1": return "itl1_latest_all"
    case "ITL2": return "itl2_latest_all"
    case "ITL3": return "itl3_latest_all"
    case "LAD": return "lad_latest_all"
    default: return "itl1_latest_all"
  }
}

function scenarioValue(
  row: { value: number | null; ci_lower?: number | null; ci_upper?: number | null; data_type?: string | null },
  scenario: Scenario
): number {
  if (row.data_type === "historical") {
    return row.value ?? 0
  }
  switch (scenario) {
    case "downside": return row.ci_lower ?? row.value ?? 0
    case "upside": return row.ci_upper ?? row.value ?? 0
    default: return row.value ?? 0
  }
}

async function fetchTimeSeries(
  metricId: string,
  regionCode: string,
  scenario: Scenario
): Promise<MetricDataPoint[]> {
  const tableName = getTableName(regionCode)
  const dbCode = getDbRegionCode(regionCode)
  
  const { data, error } = await supabase
    .from(tableName)
    .select("period, value, ci_lower, ci_upper, data_type")
    .eq("metric_id", metricId)
    .eq("region_code", dbCode)
    .order("period", { ascending: true })
  
  if (error || !data) return []
  
  return data.map(row => ({
    year: row.period,
    value: scenarioValue(row, scenario),
    scenario
  }))
}

/**
 * Fetch time series for all scenarios (for persistence computation)
 */
async function fetchAllScenarios(
  metricId: string,
  regionCode: string
): Promise<{
  baseline: MetricDataPoint[]
  principal?: MetricDataPoint[]
  high?: MetricDataPoint[]
  low?: MetricDataPoint[]
}> {
  const tableName = getTableName(regionCode)
  const dbCode = getDbRegionCode(regionCode)
  
  const { data, error } = await supabase
    .from(tableName)
    .select("period, value, ci_lower, ci_upper, data_type")
    .eq("metric_id", metricId)
    .eq("region_code", dbCode)
    .order("period", { ascending: true })
  
  if (error || !data) {
    return { baseline: [] }
  }
  
  // Build time series for each scenario
  const baseline: MetricDataPoint[] = data.map(row => ({
    year: row.period,
    value: row.value ?? 0,
    scenario: "baseline"
  }))
  
  // High and Low scenarios from CI bounds (for forecasts)
  const high: MetricDataPoint[] = data
    .filter(row => row.data_type === "forecast" && row.ci_upper !== null)
    .map(row => ({
      year: row.period,
      value: row.ci_upper ?? row.value ?? 0,
      scenario: "high"
    }))
  
  const low: MetricDataPoint[] = data
    .filter(row => row.data_type === "forecast" && row.ci_lower !== null)
    .map(row => ({
      year: row.period,
      value: row.ci_lower ?? row.value ?? 0,
      scenario: "low"
    }))
  
  return {
    baseline,
    high: high.length > 0 ? high : undefined,
    low: low.length > 0 ? low : undefined
  }
}

// =============================================================================
// Signal Categorization & UI Generation
// =============================================================================

const CHARACTER_SIGNALS = ["employment_density", "income_capture", "productivity_strength"]
const PRESSURE_SLACK_SIGNALS = ["labour_capacity", "growth_composition"]

// Priority order for dominant signal selection
const SIGNAL_PRIORITY: string[] = [
  "employment_density",
  "income_capture", 
  "labour_capacity",
  "productivity_strength",
  "growth_composition"
]

// Signal ID to user-friendly label (no jargon)
const SIGNAL_LABELS: Record<string, string> = {
  employment_density: "Job draw",
  income_capture: "Income retention",
  labour_capacity: "Workforce capacity",
  productivity_strength: "Output per job",
  growth_composition: "Growth balance"
}

// =============================================================================
// Place Context Computation (capitals, #1 rankings)
// =============================================================================

// UK and devolved capitals (by region code)
const CAPITAL_LABELS: Record<string, string> = {
  // ITL1 level
  "UKI": "UK capital region",
  // ITL3 level - capitals
  "TLM13": "Scottish capital",  // City of Edinburgh ITL3
  // LAD level - major capitals
  "E09000001": "City of London",
  "E09000033": "UK capital",  // Westminster
  "S12000036": "Scottish capital",  // City of Edinburgh LAD
  "W06000015": "Welsh capital",     // Cardiff
  "N09000003": "Northern Ireland capital", // Belfast
}

/**
 * Compute place context prefix based on:
 * 1. Capital status (UK, Scottish, Welsh, NI)
 * 2. #1 rank for key metrics (GVA, Employment)
 * 
 * Returns a short prefix like "UK capital" or "#1 GVA nationally"
 */
function computePlaceContextPrefix(
  regionCode: string,
  allMetricsData: Record<string, { current: number | null; growth5yr: number | null }>,
  regionLevel: string
): string | null {
  // Check for capital status first
  const region = REGIONS.find(r => r.code === regionCode)
  const dbCode = region?.dbCode ?? regionCode
  
  if (CAPITAL_LABELS[regionCode]) {
    return CAPITAL_LABELS[regionCode]
  }
  if (CAPITAL_LABELS[dbCode]) {
    return CAPITAL_LABELS[dbCode]
  }
  
  // For London LADs (E09...), add context
  if (dbCode.startsWith("E09")) {
    return "London borough"
  }
  
  // Could add #1 GVA/Employment detection here if we had percentiles loaded
  // For now, we rely on the signals to convey this
  
  return null
}

// Signal to verdict visual type mapping
const SIGNAL_TO_VISUAL: Record<string, VerdictVisualType> = {
  employment_density: "weekdayPull",
  income_capture: "boundary",
  labour_capacity: "workforceSlack",
  productivity_strength: "outputVsJobs",
  growth_composition: "outputVsJobs"
}

function categorizeSignals(signals: SignalResult[]): {
  characterSignals: SignalResult[]
  pressureSlackSignals: SignalResult[]
} {
  return {
    characterSignals: signals.filter((s: SignalResult) => CHARACTER_SIGNALS.includes(s.id)),
    pressureSlackSignals: signals.filter((s: SignalResult) => PRESSURE_SLACK_SIGNALS.includes(s.id))
  }
}

function getConclusions(signals: SignalResult[]): string[] {
  return signals
    .filter((s: SignalResult) => s.outcome !== "neutral" && s.conclusion)
    .map((s: SignalResult) => s.conclusion)
}

/**
 * Convert outcome to strength (1-3 dots)
 * Unified traffic light system:
 * - 3 = High/Rising (green)
 * - 2 = Neutral (amber)
 * - 1 = Low/Falling (red)
 */
function outcomeToStrength(outcome: string): 1 | 2 | 3 {
  if (outcome === "high" || outcome === "rising") return 3   // Green
  if (outcome === "neutral") return 2                        // Amber
  return 1 // low/falling                                    // Red
}

/**
 * Select dominant signal by strength then priority
 */
function selectDominantSignal(signals: SignalResult[]): SignalResult | null {
  const nonNeutral = signals.filter(s => s.outcome !== "neutral")
  if (nonNeutral.length === 0) return signals[0] || null
  
  // Sort by priority order
  nonNeutral.sort((a, b) => {
    const aPriority = SIGNAL_PRIORITY.indexOf(a.id)
    const bPriority = SIGNAL_PRIORITY.indexOf(b.id)
    return aPriority - bPriority
  })
  
  return nonNeutral[0]
}

/**
 * Generate verdict sentence (max 140 chars, no semicolons, opinionated)
 * Format: "[Place context] — [Main claim], [connector] [qualifier][temporal suffix]"
 * 
 * Place context: "UK capital", "Scottish capital", "London borough", etc.
 * 
 * Temporal suffix rules (only ONE per verdict):
 * - Holds to horizon → "through 2035"
 * - Changes within 3-5 years → ", expected to shift by {year}"
 * - Baseline only → "under baseline conditions"
 * - Mixed scenarios → no suffix (silence > hedging)
 */
function generateVerdictSentence(
  characterConclusions: string[],
  pressureSlackConclusions: string[],
  persistenceSuffix: string = "",
  placeContextPrefix: string | null = null
): string {
  const character = characterConclusions[0] || ""
  const pressure = pressureSlackConclusions[0] || ""
  
  // Extract core claims (remove preambles and qualifiers)
  const cleanClaim = (s: string) => s
    .replace(/^This area /, "")
    .replace(/^This region /, "")
    .replace(/^A high share of /, "High ")
    .replace(/^Economic output /, "Output ")
    .replace(/—.*$/, "")
    .replace(/ may /, " ")
    .replace(/ appears /, " ")
    .replace(/ likely /, " ")
    .trim()
  
  const mainClaim = cleanClaim(character)
  const qualifier = cleanClaim(pressure)
  
  // Build the core sentence first
  let coreSentence = ""
  
  // If no main claim, use qualifier with persistence
  if (!mainClaim && qualifier) {
    coreSentence = qualifier.charAt(0).toUpperCase() + qualifier.slice(1) + persistenceSuffix
  } else if (!qualifier) {
    // If no qualifier, just return main claim (no persistence on character claims)
    coreSentence = mainClaim.charAt(0).toUpperCase() + mainClaim.slice(1)
  } else {
    // Combine with "but" or "with" (no semicolons)
    const lowerQualifier = qualifier.charAt(0).toLowerCase() + qualifier.slice(1)
    const connector = lowerQualifier.includes("capacity") || lowerQualifier.includes("available") 
      ? "with" 
      : "but"
    
    // Add persistence suffix to the qualifier (pressure/slack signal)
    const qualifierWithPersistence = lowerQualifier + persistenceSuffix
    coreSentence = `${mainClaim.charAt(0).toUpperCase()}${mainClaim.slice(1)}, ${connector} ${qualifierWithPersistence}`
  }
  
  // Prepend place context if available (use colon, not em dash)
  if (placeContextPrefix) {
    const withContext = `${placeContextPrefix}: ${coreSentence.charAt(0).toLowerCase()}${coreSentence.slice(1)}`
    // Prefer always showing a full, untruncated sentence (wrapping is OK in UI)
    return withContext
  }
  
  // Prefer always showing a full, untruncated sentence (wrapping is OK in UI)
  return coreSentence
}

/**
 * Generate IC copy text
 */
function generateICCopyText(
  regionName: string,
  verdictSentence: string,
  implications: { text: string }[]
): string {
  const lines = [
    `${regionName}: ${verdictSentence}`,
    "",
    ...implications.slice(0, 3).map((impl, i) => `${i + 1}) ${impl.text}`)
  ]
  return lines.join("\n")
}

/**
 * Convert signals to UI format (max 5)
 * Shows ALL signals including neutral (source of truth)
 * Now includes robustness indicator from scenario persistence analysis
 */
function signalsToUI(
  signals: SignalResult[],
  forecastData: ForecastTimeSeries,
  year: number
): SignalForUI[] {
  return signals
    .slice(0, 5)  // Show all 5 signals
    .map(s => {
      // Compute persistence for this signal across scenarios
      const persistence = computeSignalPersistence(
        s.id,
        s.outcome,
        forecastData,
        year
      )
      
      return {
        id: s.id,
        label: SIGNAL_LABELS[s.id] || s.label,
        outcome: s.outcome,
        strength: outcomeToStrength(s.outcome),
        detail: s.detail.slice(0, 60),
        robustness: persistence.holdsIn
      }
    })
}

// =============================================================================
// Main API Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { regionCode, year, scenario } = parsed.data
    
    // Verify region exists
    const region = REGIONS.find(r => r.code === regionCode)
    if (!region) {
      return NextResponse.json(
        { error: "Unknown region code" },
        { status: 400 }
      )
    }
    
    // Fetch all metrics needed for signals
    const signalMetrics = [
      "population_total",
      "population_16_64",
      "nominal_gva_mn_gbp",
      "gdhi_per_head_gbp",
      "emp_total_jobs",
      "employment_rate_pct",
      "unemployment_rate_pct"
    ]
    
    const allMetricsData: Record<string, { current: number | null; growth5yr: number | null }> = {}
    
    // Also build forecast time series for persistence computation
    const forecastData: ForecastTimeSeries = {}
    
    for (const metricId of signalMetrics) {
      // Fetch current scenario for signal computation
      const series = await fetchTimeSeries(metricId, regionCode, scenario)
      const currentValue = series.find(d => d.year === year)?.value ?? null
      const growth = calculate5YearCAGR(series, year)
      allMetricsData[metricId] = { current: currentValue, growth5yr: growth }
      
      // Fetch all scenarios for persistence computation
      const allScenarios = await fetchAllScenarios(metricId, regionCode)
      forecastData[metricId] = allScenarios
    }
    
    // Compute all signals
    const signals = computeAllSignals(allMetricsData)
    
    // Convert to simplified format for implications engine
    const signalsForImplications: ImplicationSignalResult[] = signals.map(s => ({
      id: s.id,
      outcome: s.outcome,
      value: s.value
    }))
    
    // Categorize signals into the 3 questions
    const { characterSignals, pressureSlackSignals } = categorizeSignals(signals)
    
    // Get archetype (badge-level)
    const archetype = deriveArchetype(signals)
    
    // Derive implications (max 3)
    const implications = deriveImplications(signalsForImplications)
    
    // Get conclusions
    const characterConclusions = getConclusions(characterSignals)
    const pressureSlackConclusions = getConclusions(pressureSlackSignals)
    
    // Build UI block
    const dominantSignal = selectDominantSignal(signals)
    const dominantSignalId = dominantSignal?.id || "employment_density"
    
    // Compute signal persistence for the dominant pressure/slack signal
    // Prioritize pressure/slack signals for temporal qualifier (most decision-relevant)
    const pressureSlackSignal = pressureSlackSignals.find(s => s.outcome !== "neutral") 
      || pressureSlackSignals[0]
    
    let persistenceSuffix = ""
    if (pressureSlackSignal) {
      const persistence = computeSignalPersistence(
        pressureSlackSignal.id,
        pressureSlackSignal.outcome,
        forecastData,
        year
      )
      persistenceSuffix = formatPersistenceSuffix(persistence, year)
    }
    
    // Compute place context prefix (capitals, boroughs, etc.)
    const placeContextPrefix = computePlaceContextPrefix(
      regionCode,
      allMetricsData,
      region.level
    )
    
    const verdictSentence = generateVerdictSentence(
      characterConclusions, 
      pressureSlackConclusions,
      persistenceSuffix,
      placeContextPrefix
    )
    const verdictVisualType = SIGNAL_TO_VISUAL[dominantSignalId] || "weekdayPull"
    
    const ui: UIBlock = {
      bucketLabel: archetype?.label,
      dominantSignalId,
      verdictSentence,
      verdictVisual: { 
        type: verdictVisualType,
        payload: dominantSignal ? { outcome: dominantSignal.outcome } : undefined
      },
      icCopyText: generateICCopyText(region.name, verdictSentence, implications),
      signals: signalsToUI(signals, forecastData, year)
    }
    
    // Build response (preserves existing fields for backwards compatibility)
    const response: PlaceInsightsResponse = {
      placeCharacter: {
        conclusions: characterConclusions,
        archetype: archetype ? { label: archetype.label } : null
      },
      pressureAndSlack: {
        conclusions: pressureSlackConclusions
      },
      implications: implications.map(impl => ({
        id: impl.id,
        text: impl.text,
        relevantFor: impl.relevantFor
      })),
      ui
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error("Region insights API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
