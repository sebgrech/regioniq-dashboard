/**
 * Decision Implications Engine
 * 
 * Maps signal combinations to buyer-relevant implications.
 * Short, punchy, decision-shaped. Each is a clear "so what".
 * 
 * HARD RULES:
 * - Maximum 3 implications returned
 * - No hedging language (may, likely, appears, suggests)
 * - Extreme employment hubs get suppressed growth_composition and labour_capacity implications
 * - Small LADs (<20k population) get flagged for limited statistical confidence
 */

import type { SignalOutcome } from "./region-signals.config"

export interface SignalResult {
  id: string
  outcome: SignalOutcome
  value: number | null
}

export interface DecisionImplication {
  id: string
  text: string
  priority: number
  relevantFor: ("CRE" | "retail" | "residential" | "infrastructure" | "LA")[]
}

interface ImplicationRule {
  id: string
  conditions: { signalId: string; outcomes: SignalOutcome[] }[]
  text: string
  priority: number
  relevantFor: ("CRE" | "retail" | "residential" | "infrastructure" | "LA")[]
}

// =============================================================================
// Implication Rules
// Each implication is SHORT (<50 chars ideal), buyer-facing, decision-shaped
// NO HEDGING LANGUAGE: avoid "may", "likely", "appears", "suggests"
// =============================================================================

const IMPLICATION_RULES: ImplicationRule[] = [
  // ===========================================================================
  // Employment Density
  // ===========================================================================
  {
    id: "major_hub_worker_spend",
    conditions: [{ signalId: "employment_density", outcomes: ["extreme"] }],
    text: "Weekday demand driven by commuter workforce, not residents",
    priority: 95,
    relevantFor: ["CRE", "retail"]
  },
  {
    id: "weekday_demand_high",
    conditions: [{ signalId: "employment_density", outcomes: ["high"] }],
    text: "Weekday footfall outpaces resident population",
    priority: 90,
    relevantFor: ["CRE", "retail"]
  },
  {
    id: "weekday_demand_low",
    conditions: [{ signalId: "employment_density", outcomes: ["low"] }],
    text: "Daytime footfall relies on resident rather than worker population",
    priority: 90,
    relevantFor: ["CRE", "retail"]
  },
  {
    id: "residential_catchment",
    conditions: [{ signalId: "employment_density", outcomes: ["low"] }],
    text: "Residential and convenience retail better suited than office",
    priority: 80,
    relevantFor: ["residential", "retail"]
  },

  // ===========================================================================
  // Income Capture
  // ===========================================================================
  {
    id: "affluent_commuter_base",
    conditions: [{ signalId: "income_capture", outcomes: ["extreme_high"] }],
    text: "High-income residential base with strong local retail potential",
    priority: 90,
    relevantFor: ["retail", "residential"]
  },
  {
    id: "local_spending_power",
    conditions: [{ signalId: "income_capture", outcomes: ["high"] }],
    text: "Local spending power is strong relative to output",
    priority: 85,
    relevantFor: ["retail", "residential"]
  },
  {
    id: "output_centre_spend",
    conditions: [{ signalId: "income_capture", outcomes: ["extreme_low"] }],
    text: "Retail demand driven by worker spend, not resident purchasing power",
    priority: 85,
    relevantFor: ["retail", "CRE"]
  },
  {
    id: "value_leakage",
    conditions: [{ signalId: "income_capture", outcomes: ["low"] }],
    text: "Resident purchasing power is weaker than headline GVA",
    priority: 75,
    relevantFor: ["LA", "residential", "retail"]
  },

  // ===========================================================================
  // Labour Capacity
  // (Suppressed for extreme employment hubs via deriveImplications)
  // ===========================================================================
  {
    id: "hiring_constraints",
    conditions: [{ signalId: "labour_capacity", outcomes: ["high"] }],
    text: "Hiring is constrained for new occupiers",
    priority: 85,
    relevantFor: ["CRE", "LA"]
  },
  {
    id: "labour_availability",
    conditions: [{ signalId: "labour_capacity", outcomes: ["low"] }],
    text: "Hiring is feasible for new sites",
    priority: 80,
    relevantFor: ["CRE", "LA", "infrastructure"]
  },

  // ===========================================================================
  // Productivity
  // ===========================================================================
  {
    id: "productivity_led_growth",
    conditions: [{ signalId: "productivity_strength", outcomes: ["high", "extreme"] }],
    text: "Office absorption trails GVA growth",
    priority: 75,
    relevantFor: ["CRE", "residential"]
  },
  {
    id: "labour_led_growth",
    conditions: [{ signalId: "productivity_strength", outcomes: ["low"] }],
    text: "Space absorption tracks employment growth",
    priority: 75,
    relevantFor: ["CRE"]
  },

  // ===========================================================================
  // Growth Composition
  // (Suppressed for extreme employment hubs via deriveImplications)
  // ===========================================================================
  {
    id: "employment_growth_leading",
    conditions: [{ signalId: "growth_composition", outcomes: ["high"] }],
    text: "Employment-led growth supports daytime economy",
    priority: 70,
    relevantFor: ["CRE", "infrastructure"]
  },
  {
    id: "residential_pressure_building",
    conditions: [{ signalId: "growth_composition", outcomes: ["low"] }],
    text: "Population growth outpacing jobs — residential pressure building",
    priority: 80,
    relevantFor: ["residential", "LA", "infrastructure"]
  },

  // ===========================================================================
  // Combinations (Higher Priority)
  // ===========================================================================
  {
    id: "consumer_hub_opportunity",
    conditions: [
      { signalId: "employment_density", outcomes: ["low"] },
      { signalId: "income_capture", outcomes: ["high", "extreme_high"] }
    ],
    text: "Retail and residential better positioned than office",
    priority: 95,
    relevantFor: ["CRE", "retail", "residential"]
  },
  {
    id: "tight_market_constraints",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["high"] },
      { signalId: "employment_density", outcomes: ["high", "extreme"] }
    ],
    text: "Expansion constrained by tight labour market",
    priority: 95,
    relevantFor: ["CRE", "LA"]
  },
  {
    id: "growth_opportunity",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["low"] },
      { signalId: "growth_composition", outcomes: ["high"] }
    ],
    text: "Expansion less constrained by hiring",
    priority: 92,
    relevantFor: ["CRE", "LA", "infrastructure"]
  }
]

// =============================================================================
// Rules to suppress for extreme employment hubs
// For major employment hubs, growth_composition and labour_capacity are
// structurally irrelevant — the workforce is drawn from a regional labour market
// =============================================================================

const SUPPRESS_FOR_EXTREME_HUBS = new Set([
  "residential_pressure_building",  // growth_composition low
  "employment_growth_leading",      // growth_composition high
  "hiring_constraints",             // labour_capacity high
  "labour_availability",            // labour_capacity low
  "growth_opportunity"              // combination with growth_composition
])

// =============================================================================
// Population threshold for statistical confidence
// Small LADs have noisy data — flag implications as lower confidence
// =============================================================================

const SMALL_LAD_POPULATION_THRESHOLD = 20000

function ruleMatches(rule: ImplicationRule, signalMap: Map<string, SignalOutcome>): boolean {
  return rule.conditions.every(condition => {
    const outcome = signalMap.get(condition.signalId)
    return outcome && condition.outcomes.includes(outcome)
  })
}

/**
 * Derive decision implications from signals
 * 
 * HARD RULES:
 * - Returns maximum 3 implications, ordered by priority
 * - Suppresses growth_composition and labour_capacity implications for extreme employment hubs
 * - Adds confidence caveat for small LADs
 */
export function deriveImplications(
  signals: SignalResult[],
  population?: number | null
): DecisionImplication[] {
  const signalMap = new Map<string, SignalOutcome>()
  for (const signal of signals) {
    signalMap.set(signal.id, signal.outcome)
  }

  // Check if this is an extreme employment hub
  const isExtremeHub = signalMap.get("employment_density") === "extreme"

  // Check if this is a small LAD with noisy statistics
  const isSmallLAD = population != null && population < SMALL_LAD_POPULATION_THRESHOLD

  const matched: DecisionImplication[] = []
  
  for (const rule of IMPLICATION_RULES) {
    // Skip suppressed rules for extreme hubs
    if (isExtremeHub && SUPPRESS_FOR_EXTREME_HUBS.has(rule.id)) {
      continue
    }
    
    if (ruleMatches(rule, signalMap)) {
      let text = rule.text
      
      // Add small LAD caveat for rate-based implications
      if (isSmallLAD && (rule.id === "hiring_constraints" || rule.id === "labour_availability")) {
        text = text + " (small population — limited data confidence)"
      }
      
      matched.push({
        id: rule.id,
        text,
        priority: rule.priority,
        relevantFor: rule.relevantFor
      })
    }
  }

  // Sort by priority (highest first) and take max 3
  return matched
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
}

export function getImplicationsForBuyer(
  signals: SignalResult[],
  buyerType: "CRE" | "retail" | "residential" | "infrastructure" | "LA",
  population?: number | null
): DecisionImplication[] {
  const all = deriveImplications(signals, population)
  return all.filter(impl => impl.relevantFor.includes(buyerType))
}
