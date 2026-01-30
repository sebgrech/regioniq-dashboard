/**
 * Sector-to-Metric Mapping for Demand Context
 * 
 * Maps each tenant sector to its two most ERV-relevant metrics.
 * These are purely descriptive demand indicators, not investment advice.
 */

import type { TenantSector } from "./tenant-sector"

export interface DemandMetricConfig {
  id: string
  label: string
  format: (v: number) => string
  /** Brief description of why this metric matters for the sector */
  relevance: string
}

export interface SectorDemandConfig {
  primary: DemandMetricConfig
  secondary: DemandMetricConfig
}

/**
 * Sector-specific demand metrics mapping.
 * 
 * Each sector has a primary and secondary metric that are most relevant
 * to understanding demand drivers for that asset type:
 * 
 * - Industrial/Logistics: Productivity (GVA/job) + Labour availability
 * - Retail/F&B: Spending power (GDHI) + Footfall proxy (employment density)
 * - Office: Employment destination (density) + Income retention
 * - Residential: Rental affordability (GDHI) + Demand growth (population)
 * - Leisure: Discretionary spend (GDHI) + Population density
 */
export const SECTOR_DEMAND_METRICS: Record<TenantSector, SectorDemandConfig> = {
  industrial: {
    primary: {
      id: "gva_per_job",
      label: "GVA per job",
      format: (v) => `£${(v / 1000).toFixed(0)}k`,
      relevance: "Productivity indicator",
    },
    secondary: {
      id: "employment_rate_pct",
      label: "Employment rate",
      format: (v) => `${v.toFixed(1)}%`,
      relevance: "Workforce capacity",
    },
  },
  retail: {
    primary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Spending power",
    },
    secondary: {
      id: "employment_density",
      label: "Employment density",
      format: (v) => `${v.toFixed(2)} jobs/resident`,
      relevance: "Daytime footfall proxy",
    },
  },
  office: {
    primary: {
      id: "employment_density",
      label: "Employment density",
      format: (v) => `${v.toFixed(2)} jobs/resident`,
      relevance: "Worker destination signal",
    },
    secondary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Local spending power",
    },
  },
  f_and_b: {
    primary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Spending power",
    },
    secondary: {
      id: "employment_density",
      label: "Employment density",
      format: (v) => `${v.toFixed(2)} jobs/resident`,
      relevance: "Lunchtime trade proxy",
    },
  },
  residential: {
    primary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Rental affordability",
    },
    secondary: {
      id: "population_growth_5yr",
      label: "Population growth (5yr)",
      format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`,
      relevance: "Demand trend",
    },
  },
  leisure: {
    primary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Discretionary spend",
    },
    secondary: {
      id: "population_total",
      label: "Population",
      format: (v) => `${(v / 1000).toFixed(0)}k`,
      relevance: "Catchment size",
    },
  },
  other: {
    primary: {
      id: "gdhi_per_head_gbp",
      label: "Income per head",
      format: (v) => `£${Math.round(v).toLocaleString()}`,
      relevance: "Local spending power",
    },
    secondary: {
      id: "employment_density",
      label: "Employment density",
      format: (v) => `${v.toFixed(2)} jobs/resident`,
      relevance: "Economic activity",
    },
  },
}

/**
 * Get the demand metrics config for a given sector
 */
export function getSectorDemandMetrics(sector: TenantSector): SectorDemandConfig {
  return SECTOR_DEMAND_METRICS[sector] || SECTOR_DEMAND_METRICS.other
}
