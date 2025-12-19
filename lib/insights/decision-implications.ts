/**
 * Decision Implications Engine
 * 
 * Maps signal combinations to buyer-relevant implications.
 * Short, punchy, decision-shaped. Each is a clear "so what".
 * 
 * HARD RULE: Maximum 3 implications returned.
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

// Each implication is SHORT (<50 chars ideal), buyer-facing, decision-shaped
const IMPLICATION_RULES: ImplicationRule[] = [
  // ===========================================================================
  // Employment Density
  // ===========================================================================
  {
    id: "weekday_demand_high",
    conditions: [{ signalId: "employment_density", outcomes: ["high"] }],
    text: "Weekday footfall likely stronger than resident base suggests",
    priority: 90,
    relevantFor: ["CRE", "retail"]
  },
  {
    id: "weekday_demand_low",
    conditions: [{ signalId: "employment_density", outcomes: ["low"] }],
    text: "Daytime spend may be weaker than output suggests",
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
    id: "local_spending_power",
    conditions: [{ signalId: "income_capture", outcomes: ["high"] }],
    text: "Local spending power appears robust",
    priority: 85,
    relevantFor: ["retail", "residential"]
  },
  {
    id: "value_leakage",
    conditions: [{ signalId: "income_capture", outcomes: ["low"] }],
    text: "Local resident spending power may be weaker than output suggests; demand may not align with headline GVA",
    priority: 75,
    relevantFor: ["LA", "residential", "retail"]
  },

  // ===========================================================================
  // Labour Capacity
  // ===========================================================================
  {
    id: "hiring_constraints",
    conditions: [{ signalId: "labour_capacity", outcomes: ["high"] }],
    text: "Hiring is likely constrained for new occupiers",
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
    conditions: [{ signalId: "productivity_strength", outcomes: ["high"] }],
    text: "Office demand may lag output growth",
    priority: 75,
    relevantFor: ["CRE", "residential"]
  },
  {
    id: "labour_led_growth",
    conditions: [{ signalId: "productivity_strength", outcomes: ["low"] }],
    text: "Space absorption may track employment more closely",
    priority: 75,
    relevantFor: ["CRE"]
  },

  // ===========================================================================
  // Growth Composition
  // ===========================================================================
  {
    id: "employment_growth_leading",
    conditions: [{ signalId: "growth_composition", outcomes: ["high"] }],
    text: "Commuter inflow likely supporting daytime economy",
    priority: 70,
    relevantFor: ["CRE", "infrastructure"]
  },
  {
    id: "residential_pressure_building",
    conditions: [{ signalId: "growth_composition", outcomes: ["low"] }],
    text: "Housing pressure may be building",
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
      { signalId: "income_capture", outcomes: ["high"] }
    ],
    text: "Retail and residential better positioned than office",
    priority: 95,
    relevantFor: ["CRE", "retail", "residential"]
  },
  {
    id: "tight_market_constraints",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["high"] },
      { signalId: "employment_density", outcomes: ["high"] }
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

function ruleMatches(rule: ImplicationRule, signalMap: Map<string, SignalOutcome>): boolean {
  return rule.conditions.every(condition => {
    const outcome = signalMap.get(condition.signalId)
    return outcome && condition.outcomes.includes(outcome)
  })
}

/**
 * Derive decision implications from signals
 * HARD RULE: Returns maximum 3 implications, ordered by priority
 */
export function deriveImplications(signals: SignalResult[]): DecisionImplication[] {
  const signalMap = new Map<string, SignalOutcome>()
  for (const signal of signals) {
    signalMap.set(signal.id, signal.outcome)
  }

  const matched: DecisionImplication[] = []
  
  for (const rule of IMPLICATION_RULES) {
    if (ruleMatches(rule, signalMap)) {
      matched.push({
        id: rule.id,
        text: rule.text,
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
  buyerType: "CRE" | "retail" | "residential" | "infrastructure" | "LA"
): DecisionImplication[] {
  const all = deriveImplications(signals)
  return all.filter(impl => impl.relevantFor.includes(buyerType))
}
