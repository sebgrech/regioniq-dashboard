/**
 * Logistics-Specific Implications Engine
 *
 * Reinterprets regional signals through a logistics/industrial siting lens.
 * No new data, same ONS pipeline, different decision frame.
 *
 * Single decision axis: Labour availability. Can you staff the site?
 *
 * Hard rules:
 *   - Maximum 4 returned (1 lead + 3 supporting)
 *   - Lead is always the highest-priority match
 *   - No hedging language (may, likely, appears, suggests)
 *   - Every item includes a "why" suitable for IC memo / board deck hover
 */

import type { SignalOutcome } from "./region-signals.config"

// Re-export the minimal type the caller needs
export interface LogisticsSignalInput {
  id: string
  outcome: SignalOutcome
  value: number | null
}

export interface LogisticsImplication {
  id: string
  text: string
  why: string
  priority: number
}

interface LogisticsRule {
  id: string
  conditions: { signalId: string; outcomes: SignalOutcome[] }[]
  text: string
  why: string
  priority: number
}

// =============================================================================
// Rules, ordered by decision relevance for warehouse / distribution siting
// =============================================================================

const LOGISTICS_RULES: LogisticsRule[] = [
  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: labour capacity
  // ---------------------------------------------------------------------------
  {
    id: "logistics_labour_available",
    conditions: [{ signalId: "labour_capacity", outcomes: ["low"] }],
    text: "Available workforce supports new-site ramp-up without acute recruitment friction",
    why: "Employment rates sit below the tight-market threshold, indicating spare capacity in the working-age population. Warehouse and distribution operators can recruit at scale without competing against structural labour scarcity.",
    priority: 100,
  },
  {
    id: "logistics_labour_constrained",
    conditions: [{ signalId: "labour_capacity", outcomes: ["high"] }],
    text: "Tight labour market extends recruitment lead-times and compresses shift-fill rates",
    why: "Employment rates are high across the catchment. New logistics entrants face longer hiring cycles, above-market wage offers, and higher early-stage attrition, all of which delay operational break-even.",
    priority: 100,
  },
  {
    id: "logistics_labour_balanced",
    conditions: [{ signalId: "labour_capacity", outcomes: ["neutral"] }],
    text: "Functional labour market with standard recruitment dynamics",
    why: "Neither tight nor slack. Typical recruitment timelines and wage rates apply. No structural advantage or constraint for logistics staffing at this location.",
    priority: 55,
  },

  // ---------------------------------------------------------------------------
  // COMBINATIONS: labour x growth (highest priority when both fire)
  // ---------------------------------------------------------------------------
  {
    id: "logistics_expansion_favourable",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["low"] },
      { signalId: "growth_composition", outcomes: ["low"] },
    ],
    text: "Expanding resident population meets available workforce, optimal conditions for logistics expansion",
    why: "Population growth is outpacing local job creation, steadily deepening the recruitment pool. Combined with current labour-market slack, this is the most favourable configuration for a new distribution centre requiring rapid headcount build.",
    priority: 98,
  },
  {
    id: "logistics_expansion_contested",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["high"] },
      { signalId: "growth_composition", outcomes: ["high"] },
    ],
    text: "Employment-led growth in a tight market with higher recruitment risk for new occupiers",
    why: "Jobs are being created faster than population growth in an already-constrained labour market. New logistics operators will compete with expanding incumbents for the same finite operative pool, driving wage inflation and recruitment friction.",
    priority: 98,
  },
  {
    id: "logistics_slack_plus_employment_growth",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["low"] },
      { signalId: "growth_composition", outcomes: ["high"] },
    ],
    text: "Current workforce slack with employment-led growth, a narrowing window for logistics entry",
    why: "Available labour capacity exists today, but employment is growing faster than population. The recruitment advantage for new logistics sites diminishes over the forecast horizon as the market tightens.",
    priority: 92,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: growth composition
  // ---------------------------------------------------------------------------
  {
    id: "logistics_population_led_growth",
    conditions: [{ signalId: "growth_composition", outcomes: ["low"] }],
    text: "Residential in-migration is expanding the local labour catchment year-on-year",
    why: "Population growth exceeds job creation, growing the working-age base faster than employer demand absorbs it. For logistics operators, this translates to a deepening recruitment funnel and more competitive wage positioning over the medium term.",
    priority: 80,
  },
  {
    id: "logistics_employment_led_growth",
    conditions: [{ signalId: "growth_composition", outcomes: ["high"] }],
    text: "Employment-led growth is increasing competition for warehouse and distribution operatives",
    why: "Local job creation outpaces population growth. Existing employers are drawing from the same labour pool that a new logistics site would target, creating structural upward pressure on operative wages and recruitment timelines.",
    priority: 78,
  },
  {
    id: "logistics_growth_balanced",
    conditions: [{ signalId: "growth_composition", outcomes: ["neutral"] }],
    text: "Balanced growth with labour supply tracking demand and no structural shift",
    why: "Population and employment are expanding at similar rates. The recruitment outlook is stable, with neither a tightening nor loosening trend over the forecast horizon.",
    priority: 52,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: productivity strength
  // ---------------------------------------------------------------------------
  {
    id: "logistics_labour_intensive_economy",
    conditions: [{ signalId: "productivity_strength", outcomes: ["low"] }],
    text: "Labour-intensive local economy with workforce profile aligned to logistics operational needs",
    why: "Low GVA per job indicates a volume-driven employment base, typically comprising manufacturing, processing, and distribution roles. The local skills profile matches logistics requirements, reducing training investment and accelerating onboarding.",
    priority: 75,
  },
  {
    id: "logistics_knowledge_economy",
    conditions: [{ signalId: "productivity_strength", outcomes: ["high", "extreme"] }],
    text: "Knowledge-economy catchment where logistics wage rates compete against higher-value sectors",
    why: "High GVA per job indicates higher output per worker across the local economy. Prevailing wage benchmarks in this catchment sit above logistics-typical rates, requiring above-market offers to attract and retain warehouse operatives.",
    priority: 72,
  },
  {
    id: "logistics_standard_productivity",
    conditions: [{ signalId: "productivity_strength", outcomes: ["neutral"] }],
    text: "Diversified economy with no structural workforce mismatch for logistics",
    why: "Productivity is in line with national benchmarks, indicating a mixed sector base. Logistics recruitment operates without significant skills-profile headwinds or tailwinds.",
    priority: 50,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: income capture
  // ---------------------------------------------------------------------------
  {
    id: "logistics_low_income_catchment",
    conditions: [{ signalId: "income_capture", outcomes: ["low", "extreme_low"] }],
    text: "Lower resident incomes support competitive wage positioning for logistics roles",
    why: "Household incomes in this catchment sit below the local output benchmark. Logistics-typical wage rates are competitive relative to prevailing expectations, supporting recruitment without a cost premium.",
    priority: 65,
  },
  {
    id: "logistics_affluent_catchment",
    conditions: [{ signalId: "income_capture", outcomes: ["high", "extreme_high"] }],
    text: "Affluent residential catchment where operative wage expectations exceed logistics norms",
    why: "Above-average resident incomes set the prevailing wage benchmark across the local economy. Logistics recruitment in this catchment operates against a higher wage floor than lower-income areas.",
    priority: 62,
  },
]

// =============================================================================
// Engine
// =============================================================================

function ruleMatches(
  rule: LogisticsRule,
  signalMap: Map<string, SignalOutcome>
): boolean {
  return rule.conditions.every((c) => {
    const outcome = signalMap.get(c.signalId)
    return outcome !== undefined && c.outcomes.includes(outcome)
  })
}

const DEFAULT_LEAD: LogisticsImplication = {
  id: "logistics_default",
  text: "Standard economic conditions with no outlier signals for logistics siting",
  why: "All regional signals (labour capacity, growth composition, productivity, income capture) fall within normal ranges. No structural advantage or constraint for logistics occupiers at this location.",
  priority: 40,
}

/**
 * Derive logistics-specific implications from regional signals.
 *
 * Returns { lead, supporting }:
 *   - lead:       1 item (highest priority match)
 *   - supporting:  up to 3 additional items
 */
export function deriveLogisticsImplications(signals: LogisticsSignalInput[]): {
  lead: LogisticsImplication
  supporting: LogisticsImplication[]
} {
  const signalMap = new Map<string, SignalOutcome>()
  for (const s of signals) signalMap.set(s.id, s.outcome)

  const matched: LogisticsImplication[] = []
  for (const rule of LOGISTICS_RULES) {
    if (ruleMatches(rule, signalMap)) {
      matched.push({
        id: rule.id,
        text: rule.text,
        why: rule.why,
        priority: rule.priority,
      })
    }
  }

  // Sort by priority descending
  matched.sort((a, b) => b.priority - a.priority)

  // Deduplicate: keep only rules that don't overlap on the same signal set
  // (combination rules supersede their single-signal counterparts)
  const usedSignals = new Set<string>()
  const deduped: LogisticsImplication[] = []
  for (const impl of matched) {
    const rule = LOGISTICS_RULES.find((r) => r.id === impl.id)
    if (!rule) continue
    const ruleSignals = rule.conditions.map((c) => c.signalId)
    // If this is a single-signal rule and that signal is already covered by a combo, skip
    if (ruleSignals.length === 1 && usedSignals.has(ruleSignals[0])) continue
    for (const sig of ruleSignals) usedSignals.add(sig)
    deduped.push(impl)
  }

  const lead = deduped[0] ?? DEFAULT_LEAD
  const supporting = deduped.slice(1, 4)

  return { lead, supporting }
}
