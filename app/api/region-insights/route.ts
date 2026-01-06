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
  outcome: "high" | "low" | "neutral" | "rising" | "falling" | "extreme" | "extreme_high" | "extreme_low"
  strength: 1 | 2 | 3 | 4  // for ●●●● display (4 = extreme/purple)
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
// Place Context Computation (capitals, financial centres, major hubs)
// =============================================================================

// UK and devolved capitals + major financial/employment centres (by region code)
const PLACE_CONTEXT_LABELS: Record<string, string> = {
  // ITL1 level
  "UKI": "UK capital region",
  
  // ITL2 level - Central London
  "TLI3": "Central London",    // Inner London - West
  "TLI4": "Central London",    // Inner London - East
  
  // ITL3 level - capitals and financial centres
  "TLI31": "Central London financial district",  // Westminster
  "TLI32": "Central London",   // Camden & City of London
  "TLI41": "Central London financial district",  // Tower Hamlets (Canary Wharf)
  "TLI42": "Central London",   // Hackney & Newham
  "TLI43": "Central London",   // Lewisham & Southwark
  "TLI44": "Central London",   // Lambeth
  "TLM13": "Scottish capital", // City of Edinburgh ITL3
  
  // LAD level - major capitals and financial centres
  "E09000001": "City of London financial district",
  "E09000033": "UK capital (Westminster)",
  "E09000030": "Major financial centre (Canary Wharf)",  // Tower Hamlets
  "E09000019": "Major employment hub",   // Islington (Tech City)
  "E09000007": "Major employment hub",   // Camden (King's Cross)
  "E09000028": "Major employment hub",   // Southwark (London Bridge)
  "S12000036": "Scottish capital",       // City of Edinburgh LAD
  "W06000015": "Welsh capital",          // Cardiff
  "N09000003": "Northern Ireland capital", // Belfast
  
  // Major city centres outside London
  "E08000003": "Major city centre",      // Manchester
  "E08000025": "Major city centre",      // Birmingham
  "E08000035": "Major city centre",      // Leeds
  "S12000046": "Major city centre",      // Glasgow City
}

// Regions that are known major employment hubs (employment density structurally > 1.0)
// Used to suppress misleading signals about "residential pressure" or "commuter profile"
const MAJOR_EMPLOYMENT_HUBS = new Set([
  // London financial districts
  "E09000001", // City of London
  "E09000033", // Westminster
  "E09000030", // Tower Hamlets (Canary Wharf)
  "E09000019", // Islington
  "E09000007", // Camden
  "E09000028", // Southwark
  "E09000012", // Hackney
  "E09000013", // Hammersmith and Fulham
  // ITL3 equivalents
  "TLI31", "TLI32", "TLI41", "TLI42", "TLI43",
])

/**
 * Check if a region is a known major employment hub
 */
export function isMajorEmploymentHub(regionCode: string, dbCode?: string): boolean {
  return MAJOR_EMPLOYMENT_HUBS.has(regionCode) || 
         (dbCode !== undefined && MAJOR_EMPLOYMENT_HUBS.has(dbCode))
}

/**
 * Compute place context prefix based on:
 * 1. Capital/financial centre status
 * 2. Major employment hub status
 * 3. London borough fallback
 * 
 * Returns a short prefix like "UK capital" or "Major financial centre"
 */
function computePlaceContextPrefix(
  regionCode: string,
  allMetricsData: Record<string, { current: number | null; growth5yr: number | null }>,
  regionLevel: string
): string | null {
  // Check for capital/financial centre status first
  const region = REGIONS.find(r => r.code === regionCode)
  const dbCode = region?.dbCode ?? regionCode
  
  if (PLACE_CONTEXT_LABELS[regionCode]) {
    return PLACE_CONTEXT_LABELS[regionCode]
  }
  if (PLACE_CONTEXT_LABELS[dbCode]) {
    return PLACE_CONTEXT_LABELS[dbCode]
  }
  
  // For London LADs (E09...) not in the explicit list, add generic context
  if (dbCode.startsWith("E09")) {
    return "London borough"
  }
  
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
 * Convert outcome to strength (1-4 dots)
 * Extended traffic light system with purple tier for extreme:
 * - 4 = Extreme (purple) - major outliers like City of London, ultra-high productivity
 * - 3 = High/Rising (green)
 * - 2 = Neutral (amber)
 * - 1 = Low/Falling (red)
 * 
 * Note: extreme_high and extreme_low both map to strength=4 (purple)
 * The distinction is semantic (direction), not visual strength
 */
function outcomeToStrength(outcome: string): 1 | 2 | 3 | 4 {
  if (outcome === "extreme" || outcome === "extreme_high" || outcome === "extreme_low") return 4 // Purple
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
/**
 * Clean and strengthen claim language for OM-readiness
 * - Remove hedging ("may", "appears", "likely", "could")
 * - Remove preambles ("This area", "This region")
 * - Keep language direct and confident
 */
function cleanClaimForOM(s: string): string {
  return s
    .replace(/^This area /, "")
    .replace(/^This region /, "")
    .replace(/^A high share of /, "High ")
    .replace(/^Economic output /, "Output ")
    .replace(/—.*$/, "")
    // Remove hedging - make statements direct
    .replace(/ may support /, " supports ")
    .replace(/ may indicate /, " indicates ")
    .replace(/ may be /, " is ")
    .replace(/ may /, " ")
    .replace(/ appears to be /, " is ")
    .replace(/ appears /, " ")
    .replace(/ likely /, " ")
    .replace(/ could be /, " is ")
    .replace(/ could /, " ")
    .replace(/  +/g, " ") // Collapse double spaces
    .trim()
}

function generateVerdictSentence(
  characterConclusions: string[],
  pressureSlackConclusions: string[],
  persistenceSuffix: string = "",
  placeContextPrefix: string | null = null
): string {
  const character = characterConclusions[0] || ""
  const pressure = pressureSlackConclusions[0] || ""
  
  const mainClaim = cleanClaimForOM(character)
  const qualifier = cleanClaimForOM(pressure)
  
  // Build the core sentence first
  let coreSentence = ""
  
  // If no main claim, use qualifier with persistence
  if (!mainClaim && qualifier) {
    coreSentence = qualifier.charAt(0).toUpperCase() + qualifier.slice(1) + persistenceSuffix
  } else if (!qualifier) {
    // If no qualifier, just return main claim (no persistence on character claims)
    // This is the ideal case for extreme hubs - clean, single-clause statement
    coreSentence = mainClaim.charAt(0).toUpperCase() + mainClaim.slice(1)
  } else {
    // Combine with "with" for complementary info, avoid "but" which implies contradiction
    const lowerQualifier = qualifier.charAt(0).toLowerCase() + qualifier.slice(1)
    
    // Use "with" for capacity/labour signals, otherwise append as additional info
    const connector = lowerQualifier.includes("capacity") || 
                      lowerQualifier.includes("available") ||
                      lowerQualifier.includes("hiring") ||
                      lowerQualifier.includes("labour")
      ? "with" 
      : "—" // Use em dash for secondary observations
    
    // Add persistence suffix to the qualifier (pressure/slack signal)
    const qualifierWithPersistence = lowerQualifier + persistenceSuffix
    coreSentence = `${mainClaim.charAt(0).toUpperCase()}${mainClaim.slice(1)}${connector === "—" ? " — " : ", " + connector + " "}${qualifierWithPersistence}`
  }
  
  // Prepend place context if available (use colon)
  if (placeContextPrefix) {
    const withContext = `${placeContextPrefix}: ${coreSentence.charAt(0).toLowerCase()}${coreSentence.slice(1)}`
    return withContext
  }
  
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
    
    // Check if this is an extreme employment hub
    // For extreme hubs, growth_composition conclusions are structurally irrelevant
    // (e.g., City of London with 500k jobs and 10k residents — pop growth % comparisons are meaningless)
    const employmentDensitySignal = signals.find(s => s.id === "employment_density")
    const isExtremeEmploymentHub = employmentDensitySignal?.outcome === "extreme"
    
    // Gate pressure/slack conclusions for extreme employment hubs
    // Only suppress growth_composition, keep labour_capacity conclusions
    const pressureSlackConclusions = isExtremeEmploymentHub
      ? getConclusions(pressureSlackSignals.filter(s => s.id !== "growth_composition"))
      : getConclusions(pressureSlackSignals)
    
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
