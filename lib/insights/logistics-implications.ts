/**
 * Regional Economic Positioning Engine
 *
 * Surfaces the most decision-relevant economic characteristics of a catchment
 * from 5 ONS-derived signals. Asset-class neutral: every statement is a
 * factual observation about the data. The reader applies their own lens.
 *
 * Hard rules:
 *   - Maximum 4 returned (1 lead + 3 supporting)
 *   - Lead is always the highest-priority match
 *   - No hedging language (may, likely, appears, suggests)
 *   - No asset-class interpretation (no "for logistics", "for office", etc.)
 *   - Every sentence must be defensible if challenged: "how do you know this?"
 *   - Answer is always: "because this ONS metric is above/below this threshold"
 */

import type { SignalOutcome } from "./region-signals.config"

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
// Rules — ordered by signal salience for siting decisions
// =============================================================================

const LOGISTICS_RULES: LogisticsRule[] = [
  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: labour capacity (employment rate)
  // ---------------------------------------------------------------------------
  {
    id: "logistics_labour_available",
    conditions: [{ signalId: "labour_capacity", outcomes: ["low"] }],
    text: "Employment rate is below the national benchmark, indicating spare capacity in the working-age population",
    why: "A lower employment rate means a larger share of the local working-age population is not currently in work. This represents available labour capacity in the catchment.",
    priority: 100,
  },
  {
    id: "logistics_labour_constrained",
    conditions: [{ signalId: "labour_capacity", outcomes: ["high"] }],
    text: "Employment rate is above the national benchmark, indicating limited spare capacity in the working-age population",
    why: "A higher employment rate means a smaller share of the local working-age population is not currently in work. The available labour pool in this catchment is structurally smaller.",
    priority: 100,
  },
  {
    id: "logistics_labour_balanced",
    conditions: [{ signalId: "labour_capacity", outcomes: ["neutral"] }],
    text: "Employment rate is in line with the national benchmark",
    why: "The share of the working-age population in employment sits within the normal range. No structural tightness or slack in the local labour market.",
    priority: 55,
  },

  // ---------------------------------------------------------------------------
  // COMBINATIONS: labour capacity x growth composition
  // ---------------------------------------------------------------------------
  {
    id: "logistics_expansion_favourable",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["low"] },
      { signalId: "growth_composition", outcomes: ["low"] },
    ],
    text: "Available labour capacity with population growing faster than employment",
    why: "The employment rate is below benchmark (spare capacity exists) and population growth is outpacing job creation (the working-age base is expanding faster than demand absorbs it). Both signals point in the same direction.",
    priority: 98,
  },
  {
    id: "logistics_expansion_contested",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["high"] },
      { signalId: "growth_composition", outcomes: ["high"] },
    ],
    text: "Limited labour capacity with employment growing faster than population",
    why: "The employment rate is above benchmark (limited spare capacity) and jobs are being created faster than population is growing. Both signals point in the same direction: the labour market is tightening.",
    priority: 98,
  },
  {
    id: "logistics_slack_plus_employment_growth",
    conditions: [
      { signalId: "labour_capacity", outcomes: ["low"] },
      { signalId: "growth_composition", outcomes: ["high"] },
    ],
    text: "Current labour capacity exists, but employment is growing faster than population",
    why: "Spare capacity is present today (employment rate below benchmark), but jobs are being created faster than population is growing. The two signals are moving in opposite directions over the forecast horizon.",
    priority: 92,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: growth composition (population vs employment growth)
  // ---------------------------------------------------------------------------
  {
    id: "logistics_population_led_growth",
    conditions: [{ signalId: "growth_composition", outcomes: ["low"] }],
    text: "Population growth is outpacing employment growth in this catchment",
    why: "Net residential in-migration is growing the working-age base faster than local job creation is absorbing it. The ratio of residents to jobs is increasing over the forecast period.",
    priority: 80,
  },
  {
    id: "logistics_employment_led_growth",
    conditions: [{ signalId: "growth_composition", outcomes: ["high"] }],
    text: "Employment growth is outpacing population growth in this catchment",
    why: "Local job creation exceeds net population growth. The ratio of jobs to residents is increasing over the forecast period.",
    priority: 78,
  },
  {
    id: "logistics_growth_balanced",
    conditions: [{ signalId: "growth_composition", outcomes: ["neutral"] }],
    text: "Population and employment are growing at similar rates",
    why: "Neither is materially outpacing the other. The balance between residents and jobs is stable over the forecast period.",
    priority: 52,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: productivity strength (GVA per job)
  // ---------------------------------------------------------------------------
  {
    id: "logistics_labour_intensive_economy",
    conditions: [{ signalId: "productivity_strength", outcomes: ["low"] }],
    text: "GVA per job is below the national benchmark, indicating a lower-output employment base",
    why: "Economic output per worker is lower than the national average. This is a structural characteristic of the local economy, reflecting the mix of sectors and roles present in the catchment.",
    priority: 75,
  },
  {
    id: "logistics_knowledge_economy",
    conditions: [{ signalId: "productivity_strength", outcomes: ["high", "extreme"] }],
    text: "GVA per job is above the national benchmark, indicating a higher-output employment base",
    why: "Economic output per worker exceeds the national average. Prevailing wage benchmarks in this catchment are structurally higher as a result.",
    priority: 72,
  },
  {
    id: "logistics_standard_productivity",
    conditions: [{ signalId: "productivity_strength", outcomes: ["neutral"] }],
    text: "GVA per job is in line with the national benchmark",
    why: "Economic output per worker sits within the normal range. No structural skew toward higher-output or lower-output employment.",
    priority: 50,
  },

  // ---------------------------------------------------------------------------
  // SINGLE-SIGNAL: income capture (GDHI per head vs local output)
  // ---------------------------------------------------------------------------
  {
    id: "logistics_low_income_catchment",
    conditions: [{ signalId: "income_capture", outcomes: ["low", "extreme_low"] }],
    text: "Resident incomes are below the local output benchmark",
    why: "Gross disposable household income per head is low relative to local GVA. A smaller share of local economic output is translating into resident purchasing power.",
    priority: 65,
  },
  {
    id: "logistics_affluent_catchment",
    conditions: [{ signalId: "income_capture", outcomes: ["high", "extreme_high"] }],
    text: "Resident incomes are above the local output benchmark",
    why: "Gross disposable household income per head is high relative to local GVA. Prevailing wage expectations in this catchment are structurally higher.",
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
  text: "All regional signals fall within normal ranges",
  why: "Labour capacity, growth composition, productivity, and income capture are all in line with national benchmarks. No structural outlier in this catchment.",
  priority: 40,
}

/**
 * Derive the most decision-relevant economic characteristics from regional signals.
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

  // Deduplicate: combination rules supersede their single-signal counterparts
  const usedSignals = new Set<string>()
  const deduped: LogisticsImplication[] = []
  for (const impl of matched) {
    const rule = LOGISTICS_RULES.find((r) => r.id === impl.id)
    if (!rule) continue
    const ruleSignals = rule.conditions.map((c) => c.signalId)
    if (ruleSignals.length === 1 && usedSignals.has(ruleSignals[0])) continue
    for (const sig of ruleSignals) usedSignals.add(sig)
    deduped.push(impl)
  }

  const lead = deduped[0] ?? DEFAULT_LEAD
  const supporting = deduped.slice(1, 4)

  return { lead, supporting }
}
