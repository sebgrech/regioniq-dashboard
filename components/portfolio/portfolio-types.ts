/**
 * Shared types, constants, and helpers for the portfolio v2 module.
 * Single source of truth — imported by all portfolio sub-components.
 */

import type { LucideIcon } from "lucide-react"
import {
  Building2,
  Briefcase,
  ShoppingBag,
  Home,
  Dumbbell,
  Warehouse,
  UtensilsCrossed,
} from "lucide-react"
// =============================================================================
// Core portfolio asset type — canonical definition
// =============================================================================

export interface PortfolioAssetItem {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  asset_type: string | null
  asset_class: string | null
  sq_ft: number | null
  portfolio_owner: string | null
  source: "deal" | "portfolio" | "user"
}

// =============================================================================
// Metric definitions
// =============================================================================

export interface MetricConfig {
  id: string
  label: string
  unit: string
}

export const METRICS: MetricConfig[] = [
  { id: "gdhi_per_head_gbp", label: "Income per Head", unit: "£" },
  { id: "nominal_gva_mn_gbp", label: "GVA", unit: "£m" },
  { id: "emp_total_jobs", label: "Employment", unit: "jobs" },
  { id: "population_total", label: "Population", unit: "" },
]

// =============================================================================
// Signal definitions
// =============================================================================

export const SIGNAL_IDS = [
  "employment_density",
  "income_capture",
  "labour_capacity",
  "productivity_strength",
  "growth_composition",
] as const

export const SIGNAL_LABELS: Record<string, string> = {
  employment_density: "Job Draw",
  income_capture: "Income Retention",
  labour_capacity: "Labour Availability",
  productivity_strength: "Productivity",
  growth_composition: "Growth Balance",
}

// =============================================================================
// Data types
// =============================================================================

export interface AssetSeriesData {
  regionCode: string
  data: { year: number; value: number; type?: "historical" | "forecast" }[]
}

export interface SignalData {
  outcome:
    | "high"
    | "low"
    | "neutral"
    | "rising"
    | "falling"
    | "extreme"
    | "extreme_high"
    | "extreme_low"
  strength: 1 | 2 | 3 | 4
  detail: string
}

export interface RegionSignals {
  archetype: string | null
  signals: Record<string, SignalData>
}

export interface GeocodedAsset {
  assetId: string
  lat: number
  lng: number
}

// =============================================================================
// Color palette (Linear/Stripe inspired)
// =============================================================================

export const ASSET_COLORS = [
  "#6366f1", // Indigo
  "#0ea5e9", // Sky blue
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#84cc16", // Lime
]

// =============================================================================
// Helpers
// =============================================================================

export function getAssetClassIcon(assetClass: string | null): LucideIcon {
  if (!assetClass) return Building2
  const normalized = assetClass.toLowerCase().trim()
  switch (normalized) {
    case "retail":
      return ShoppingBag
    case "office":
      return Briefcase
    case "residential":
      return Home
    case "leisure":
      return Dumbbell
    case "industrial":
      return Warehouse
    case "f&b":
    case "food & beverage":
    case "restaurant":
      return UtensilsCrossed
    default:
      return Building2
  }
}

export function shortAddress(address: string, max = 28): string {
  if (address.length <= max) return address
  return address.slice(0, max - 1).trimEnd() + "\u2026"
}

export function formatAbsoluteValue(value: number, unit: string): string {
  if (unit === "£") {
    return `\u00A3${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  } else if (unit === "£m") {
    if (value >= 1000) return `\u00A3${(value / 1000).toFixed(1)}bn`
    return `\u00A3${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}m`
  } else if (unit === "jobs") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return value.toLocaleString()
  } else {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}m`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return value.toLocaleString()
  }
}

// Signal-specific phrasing overrides for inverted signals
const STRONG_OVERRIDE: Record<string, string> = {
  labour_capacity: "Available labour pool",
}
const WEAK_OVERRIDE: Record<string, string> = {
  labour_capacity: "tight labour market",
}

/** Plain-English signal digest for a region */
export function signalDigest(signals: Record<string, SignalData>): string {
  const strong = Object.entries(signals)
    .filter(([, s]) => s.strength >= 3)
    .map(([id]) => STRONG_OVERRIDE[id] ?? SIGNAL_LABELS[id])
  const weak = Object.entries(signals)
    .filter(([, s]) => s.strength === 1)
    .map(([id]) => WEAK_OVERRIDE[id] ?? SIGNAL_LABELS[id])
  const parts: string[] = []
  if (strong.length)
    parts.push("Strong " + strong.slice(0, 2).join(" & ").toLowerCase())
  if (weak.length) {
    const weakLabel = weak.slice(0, 1)[0]
    // If the label came from an override, use it as-is (it already reads naturally)
    const weakId = Object.entries(signals).filter(([, s]) => s.strength === 1).map(([id]) => id)[0]
    const isOverride = weakId && WEAK_OVERRIDE[weakId]
    parts.push(isOverride ? weakLabel : "weak " + weakLabel?.toLowerCase())
  }
  return parts.join("; ") || "Balanced profile"
}
