/**
 * Region Signals Configuration
 * 
 * Signals are computed from metric combinations and emit IC-safe conclusions.
 * Show conclusions, not ratios. Ratios only visible on expand.
 */

export type SignalOutcome = "high" | "low" | "neutral" | "rising" | "falling"

export interface SignalConfig {
  id: string
  /** Internal label (not shown to users) */
  label: string
  /** What this signal measures */
  description: string
  
  computation: {
    type: "ratio" | "rate_divergence" | "growth_comparison"
    /** Metric IDs used in computation */
    metrics: string[]
  }
  
  /** Thresholds for outcome determination */
  thresholds: {
    high?: number
    low?: number
    rising?: number
    falling?: number
  }
  
  /** IC-safe conclusions shown to users */
  conclusions: {
    high: string
    low: string
    neutral?: string
    rising?: string
    falling?: string
  }
  
  /** Detail template shown on expand (can include {value}) */
  detail: string
}

export interface ArchetypeRule {
  id: string
  label: string
  /** IC-safe conclusion for this archetype */
  conclusion: string
  /** Required signal outcomes to match this archetype */
  requiredSignals: { signalId: string; outcome: SignalOutcome }[]
  /** Optional signals that strengthen the match */
  optionalSignals?: { signalId: string; outcome: SignalOutcome }[]
}

/**
 * S-Tier Signals - Ship These
 * 
 * All computed from existing metrics.
 * Each outputs IC-safe conclusions, not ratios.
 */
export const REGION_SIGNALS: SignalConfig[] = [
  // ===========================================================================
  // S-TIER: Employment Density (Jobs vs Working-Age Pop)
  // ===========================================================================
  {
    id: "employment_density",
    label: "Employment Density",
    description: "Jobs per working-age resident",
    computation: {
      type: "ratio",
      metrics: ["emp_total_jobs", "population_16_64"]
    },
    thresholds: {
      high: 1.0,  // >1.0 = more jobs than working-age residents
      low: 0.8    // <0.8 = residential catchment
    },
    conclusions: {
      high: "Employment destination, may support stronger weekday demand for office and services",
      low: "Residential catchment, workforce likely exports to neighbouring employment centres",
      neutral: "Employment broadly matches the local working-age population"
    },
    detail: "{value} jobs per working-age resident"
  },

  // ===========================================================================
  // S-TIER: Income Capture (GDHI ÷ GVA)
  // ===========================================================================
  {
    id: "income_capture",
    label: "Income Capture",
    description: "Resident incomes relative to local economic output",
    computation: {
      type: "ratio",
      metrics: ["gdhi_per_head_gbp", "nominal_gva_mn_gbp", "population_total"]
      // Computed as: gdhi_per_head / (gva * 1_000_000 / population)
    },
    thresholds: {
      high: 0.7,  // >70% = strong resident incomes relative to output
      low: 0.5    // <50% = mismatch between output and resident purchasing power
    },
    conclusions: {
      high: "Resident incomes appear strong relative to local output",
      low: "Resident incomes are low relative to local output, purchasing power may not match headline GVA",
      neutral: "Resident incomes appear broadly aligned with local output"
    },
    detail: "{value}% income-to-output ratio"
  },

  // ===========================================================================
  // S-TIER: Labour Market Capacity
  // ===========================================================================
  {
    id: "labour_capacity",
    label: "Labour Market Capacity",
    description: "Employment rate vs unemployment rate pattern",
    computation: {
      type: "rate_divergence",
      metrics: ["employment_rate_pct", "unemployment_rate_pct"]
    },
    thresholds: {
      high: 76,    // Employment rate > 76% = tight
      low: 72,     // Employment rate < 72% = slack
      rising: 0.5, // Unemployment rising >0.5pp = tightening turning
      falling: -0.5
    },
    conclusions: {
      high: "Limited spare labour capacity, hiring constraints may apply",
      low: "Slack remains in the working-age population",
      neutral: "Labour market capacity appears balanced",
      rising: "Labour supply may be becoming constrained",
      falling: "Labour capacity appears to be expanding"
    },
    detail: "Employment rate {empRate}%, unemployment {unempRate}%"
  },

  // ===========================================================================
  // TIER-A: Productivity Strength
  // ===========================================================================
  {
    id: "productivity_strength",
    label: "Productivity",
    description: "Economic output per job",
    computation: {
      type: "ratio",
      metrics: ["nominal_gva_mn_gbp", "emp_total_jobs"]
      // Computed as: (gva * 1_000_000) / jobs
    },
    thresholds: {
      high: 70000,  // >£70k per job = high value-add
      low: 45000    // <£45k per job = volume-driven
    },
    conclusions: {
      high: "High value-add economy, growth may be productivity-led",
      low: "Volume-driven employment base, growth appears labour-led",
      neutral: "Productivity appears broadly in line with national average"
    },
    detail: "£{value} GVA per job"
  },

  // ===========================================================================
  // TIER-A: Growth Composition
  // ===========================================================================
  {
    id: "growth_composition",
    label: "Growth Composition",
    description: "Comparing population, employment, and GVA growth rates",
    computation: {
      type: "growth_comparison",
      metrics: ["population_total", "emp_total_jobs", "nominal_gva_mn_gbp"]
    },
    thresholds: {
      high: 1.0,   // Jobs growth > pop growth by 1pp+
      low: -1.0    // Pop growth > jobs growth by 1pp+
    },
    conclusions: {
      high: "Employment growth appears to be outpacing population, may indicate commuter inflow",
      low: "Population growth may be outpacing jobs, residential pressure could be building",
      neutral: "Growth appears balanced across population and employment"
    },
    detail: "Population {popGrowth}%, Employment {empGrowth}%, GVA {gvaGrowth}%"
  }
]

/**
 * Archetype Rules
 * 
 * Archetypes are derived from signal combinations.
 * Order matters: first matching archetype wins.
 */
export const ARCHETYPE_RULES: ArchetypeRule[] = [
  {
    id: "economic_powerhouse",
    label: "Economic Powerhouse",
    conclusion: "Characteristics suggest a major employment hub with high-value output",
    requiredSignals: [
      { signalId: "employment_density", outcome: "high" },
      { signalId: "productivity_strength", outcome: "high" }
    ]
  },
  {
    id: "production_centre",
    label: "Production Centre",
    conclusion: "Economic output centre, value may flow elsewhere",
    requiredSignals: [
      { signalId: "employment_density", outcome: "high" },
      { signalId: "income_capture", outcome: "low" }
    ]
  },
  {
    id: "consumer_hub",
    label: "Consumer Hub",
    conclusion: "Profile suggests strong local spending power with residential focus",
    requiredSignals: [
      { signalId: "income_capture", outcome: "high" },
      { signalId: "employment_density", outcome: "low" }
    ]
  },
  {
    id: "affluent_suburb",
    label: "Affluent Suburb",
    conclusion: "High-income residential area, workforce likely exports elsewhere",
    requiredSignals: [
      { signalId: "income_capture", outcome: "high" }
    ],
    optionalSignals: [
      { signalId: "employment_density", outcome: "low" }
    ]
  },
  {
    id: "growth_corridor",
    label: "Growth Corridor",
    conclusion: "Expansion appears employment-led",
    requiredSignals: [
      { signalId: "growth_composition", outcome: "high" }
    ]
  },
  {
    id: "residential_pressure",
    label: "Residential Growth Area",
    conclusion: "Population may be expanding faster than local employment",
    requiredSignals: [
      { signalId: "growth_composition", outcome: "low" }
    ]
  },
  {
    id: "tight_labour_market",
    label: "Tight Labour Market",
    conclusion: "Limited spare labour capacity may constrain growth",
    requiredSignals: [
      { signalId: "labour_capacity", outcome: "high" }
    ]
  },
  {
    id: "labour_slack",
    label: "Untapped Workforce",
    conclusion: "Available labour capacity may support expansion",
    requiredSignals: [
      { signalId: "labour_capacity", outcome: "low" }
    ]
  },
  {
    id: "balanced_economy",
    label: "Balanced Economy",
    conclusion: "Relatively stable economic profile across key indicators",
    requiredSignals: [] // Default if no other matches
  }
]

/**
 * Get signal config by ID
 */
export function getSignalConfig(signalId: string): SignalConfig | undefined {
  return REGION_SIGNALS.find(s => s.id === signalId)
}

/**
 * Get all signal IDs
 */
export function getSignalIds(): string[] {
  return REGION_SIGNALS.map(s => s.id)
}

