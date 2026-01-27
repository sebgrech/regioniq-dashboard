/**
 * Region Signals Configuration
 * 
 * Signals are computed from metric combinations and emit IC-safe conclusions.
 * Show conclusions, not ratios. Ratios only visible on expand.
 */

export type SignalOutcome = "high" | "low" | "neutral" | "rising" | "falling" | "extreme" | "extreme_high" | "extreme_low"

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
    extreme?: number  // For extreme outliers (e.g., employment density > 3.0)
    high?: number
    low?: number
    rising?: number
    falling?: number
  }
  
  /** IC-safe conclusions shown to users */
  conclusions: {
    extreme?: string  // For extreme outliers
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
      extreme: 3.0, // >3.0 = major employment hub (City of London, Westminster, Canary Wharf)
      high: 1.0,    // >1.0 = more jobs than working-age residents
      low: 0.8      // <0.8 = residential catchment
    },
    conclusions: {
      extreme: "Major employment destination with extremely high job concentration",
      high: "Employment destination supporting weekday demand for office and services",
      low: "Residential catchment where residents commute to nearby employment hubs",
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
      extreme_high: 1.0,  // >100% = affluent commuter suburb (residents earn more than local output per head)
      extreme_low: 0.3,   // <30% = major production/output centre (value flows out)
      high: 0.7,          // >70% = strong resident incomes relative to output
      low: 0.5            // <50% = mismatch between output and resident purchasing power
    },
    conclusions: {
      extreme_high: "Affluent residential area — resident incomes exceed local economic output per head",
      extreme_low: "Major output centre — economic value flows to non-resident stakeholders",
      high: "Strong resident incomes relative to local output",
      low: "Resident incomes are low relative to local output — purchasing power does not match headline GVA",
      neutral: "Resident incomes broadly aligned with local output"
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
      high: "Tight labour market with hiring constraints",
      low: "Slack in the working-age population",
      neutral: "Labour market capacity is balanced",
      rising: "Labour supply becoming constrained",
      falling: "Labour capacity expanding"
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
      extreme: 120000, // >£120k per job = finance/oil & gas/pharma cluster
      high: 70000,     // >£70k per job = high value-add
      low: 45000       // <£45k per job = volume-driven
    },
    conclusions: {
      extreme: "Ultra-high productivity economy — finance, energy, or specialist cluster",
      high: "High value-add economy with productivity-led growth",
      low: "Volume-driven employment base with labour-led growth",
      neutral: "Productivity broadly in line with national average"
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
      high: "Employment growth outpacing population — commuter inflow indicator",
      low: "Population growth outpacing jobs — residential pressure building",
      neutral: "Growth balanced across population and employment"
    },
    detail: "Population {popGrowth}%, Employment {empGrowth}%, GVA {gvaGrowth}%"
  }
]

/**
 * Archetype Rules
 * 
 * Archetypes are derived from signal combinations.
 * Order matters: first matching archetype wins.
 * 
 * IMPORTANT: "extreme" employment density regions (City of London, Westminster, etc.)
 * should match the Major Employment Hub archetype first, before any other rules.
 */
export const ARCHETYPE_RULES: ArchetypeRule[] = [
  // ==========================================================================
  // EXTREME EMPLOYMENT HUBS (must come first - these override all other rules)
  // ==========================================================================
  {
    id: "major_employment_hub",
    label: "Major Employment Hub",
    conclusion: "A primary employment destination with job concentration far exceeding local population",
    requiredSignals: [
      { signalId: "employment_density", outcome: "extreme" }
    ]
  },
  // ==========================================================================
  // STANDARD ARCHETYPES
  // ==========================================================================
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
    conclusion: "Economic output centre with value flowing elsewhere",
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
    conclusion: "High-income residential area with workforce exporting elsewhere",
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
    conclusion: "Employment-led expansion",
    requiredSignals: [
      { signalId: "growth_composition", outcome: "high" }
    ]
  },
  {
    id: "residential_pressure",
    label: "Residential Growth Area",
    conclusion: "Population expanding faster than local employment",
    requiredSignals: [
      { signalId: "growth_composition", outcome: "low" }
    ]
  },
  {
    id: "tight_labour_market",
    label: "Tight Labour Market",
    conclusion: "Limited spare labour capacity constraining growth",
    requiredSignals: [
      { signalId: "labour_capacity", outcome: "high" }
    ]
  },
  {
    id: "labour_slack",
    label: "Untapped Workforce",
    conclusion: "Available labour capacity supporting expansion potential",
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

