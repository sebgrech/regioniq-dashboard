/**
 * Metric Insights Configuration
 * 
 * Each metric defines its own insight rules via config, not code.
 * Adding a new metric = adding a config entry. No code changes required.
 */

export interface MetricInsightConfig {
  id: string
  label: string
  
  interpretation: {
    /** Whether higher values are generally better (null = context-dependent) */
    higherIsBetter: boolean | null
    /** Growth rate thresholds for "strong" vs "weak" conclusions */
    growthThresholds: { strong: number; weak: number }
  }
  
  /** Which comparisons to compute */
  comparisons: {
    peers: boolean      // Compare to peer regions (same parent)
    national: boolean   // Compare to UK average
    historical: boolean // Compare to own history
  }
  
  /** IC-safe conclusion templates. Use {placeholders} for dynamic values. */
  conclusions: {
    rankTop: string      // When ranked in top 3
    rankBottom: string   // When ranked in bottom 3
    rankMiddle: string   // Middle of pack
    growthStrong: string // Growth above strong threshold
    growthWeak: string   // Growth below weak threshold
    growthNegative: string // Negative growth
    aboveNational: string  // Above UK average
    belowNational: string  // Below UK average
  }
}

/**
 * Configuration for all supported metrics.
 * To add a new metric (e.g., house_prices_median), add an entry here.
 */
export const METRIC_INSIGHTS_CONFIG: Record<string, MetricInsightConfig> = {
  population_total: {
    id: "population_total",
    label: "Population",
    interpretation: {
      higherIsBetter: null, // Context-dependent
      growthThresholds: { strong: 1.0, weak: 0.3 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "One of the largest populations among {peerGroup}",
      rankBottom: "One of the smallest populations among {peerGroup}",
      rankMiddle: "Mid-sized population among {peerGroup}",
      growthStrong: "Population growing strongly at {rate}% annually",
      growthWeak: "Population growth subdued at {rate}% annually",
      growthNegative: "Population declining at {rate}% annually",
      aboveNational: "Population growth exceeds national average",
      belowNational: "Population growth trails national average"
    }
  },

  population_16_64: {
    id: "population_16_64",
    label: "Working-Age Population",
    interpretation: {
      higherIsBetter: null,
      growthThresholds: { strong: 1.0, weak: 0.2 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Large working-age population among {peerGroup}",
      rankBottom: "Smaller working-age population among {peerGroup}",
      rankMiddle: "Average working-age population for {peerGroup}",
      growthStrong: "Working-age population expanding at {rate}% annually",
      growthWeak: "Working-age population growth modest at {rate}%",
      growthNegative: "Working-age population contracting at {rate}%",
      aboveNational: "Working-age growth outpacing national trend",
      belowNational: "Working-age growth lagging national trend"
    }
  },

  nominal_gva_mn_gbp: {
    id: "nominal_gva_mn_gbp",
    label: "Gross Value Added",
    interpretation: {
      higherIsBetter: true,
      growthThresholds: { strong: 3.0, weak: 1.0 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Highest economic output among {peerGroup}",
      rankBottom: "Lower economic output relative to {peerGroup}",
      rankMiddle: "Mid-table economic output among {peerGroup}",
      growthStrong: "Economic output expanding strongly at {rate}% annually",
      growthWeak: "Economic growth subdued at {rate}% annually",
      growthNegative: "Economic output contracting at {rate}%",
      aboveNational: "GVA growth exceeds national average",
      belowNational: "GVA growth trails national average"
    }
  },

  gdhi_per_head_gbp: {
    id: "gdhi_per_head_gbp",
    label: "Disposable Income",
    interpretation: {
      higherIsBetter: true,
      growthThresholds: { strong: 3.0, weak: 1.5 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Highest household income among {peerGroup}",
      rankBottom: "Lower household income relative to {peerGroup}",
      rankMiddle: "Average household income for {peerGroup}",
      growthStrong: "Household income rising strongly at {rate}% annually",
      growthWeak: "Income growth modest at {rate}% annually",
      growthNegative: "Real income under pressure, declining {rate}%",
      aboveNational: "Income growth exceeds national average",
      belowNational: "Income growth trails national average"
    }
  },

  emp_total_jobs: {
    id: "emp_total_jobs",
    label: "Total Employment",
    interpretation: {
      higherIsBetter: true,
      growthThresholds: { strong: 2.0, weak: 0.5 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Major employment centre among {peerGroup}",
      rankBottom: "Smaller employment base relative to {peerGroup}",
      rankMiddle: "Average employment base for {peerGroup}",
      growthStrong: "Strong job creation at {rate}% annually",
      growthWeak: "Employment growth modest at {rate}% annually",
      growthNegative: "Employment contracting at {rate}%",
      aboveNational: "Job growth exceeds national average",
      belowNational: "Job growth trails national average"
    }
  },

  employment_rate_pct: {
    id: "employment_rate_pct",
    label: "Employment Rate",
    interpretation: {
      higherIsBetter: true,
      growthThresholds: { strong: 1.0, weak: 0.3 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "High employment rate among {peerGroup}",
      rankBottom: "Lower employment rate relative to {peerGroup}",
      rankMiddle: "Average employment rate for {peerGroup}",
      growthStrong: "Employment rate rising strongly",
      growthWeak: "Employment rate relatively stable",
      growthNegative: "Employment rate declining",
      aboveNational: "Employment rate above national average",
      belowNational: "Employment rate below national average"
    }
  },

  unemployment_rate_pct: {
    id: "unemployment_rate_pct",
    label: "Unemployment Rate",
    interpretation: {
      higherIsBetter: false, // Lower is better
      growthThresholds: { strong: -0.5, weak: 0.5 } // Negative = improving
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Higher unemployment relative to {peerGroup}",
      rankBottom: "Low unemployment among {peerGroup}",
      rankMiddle: "Average unemployment for {peerGroup}",
      growthStrong: "Unemployment falling significantly",
      growthWeak: "Unemployment relatively stable",
      growthNegative: "Unemployment rising",
      aboveNational: "Unemployment above national average",
      belowNational: "Unemployment below national average"
    }
  }
}

/**
 * Get config for a metric, with fallback defaults
 */
export function getMetricInsightConfig(metricId: string): MetricInsightConfig {
  return METRIC_INSIGHTS_CONFIG[metricId] ?? {
    id: metricId,
    label: metricId,
    interpretation: {
      higherIsBetter: null,
      growthThresholds: { strong: 2.0, weak: 0.5 }
    },
    comparisons: { peers: true, national: true, historical: true },
    conclusions: {
      rankTop: "Among the highest in {peerGroup}",
      rankBottom: "Among the lowest in {peerGroup}",
      rankMiddle: "Average for {peerGroup}",
      growthStrong: "Growing strongly at {rate}%",
      growthWeak: "Growth modest at {rate}%",
      growthNegative: "Declining at {rate}%",
      aboveNational: "Above national average",
      belowNational: "Below national average"
    }
  }
}

