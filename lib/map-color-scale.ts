/**
 * Map Color Scale Utility
 * 
 * Smooth, professional gradient for map visualizations.
 * 
 * Core principles:
 * - ONE smooth scale for ALL metrics (levels AND growth rates)
 * - Warm-to-cool gradient: Orange → Cream → Indigo
 * - Clear narrative: "Underperforming → Average → Outperforming"
 * - Matches house chart palette (indigo primary, orange accent)
 * - Grey ONLY for no-data (never for actual values)
 * - Supports metric direction inversion (e.g., unemployment: lower = better)
 * 
 * Color ramp:
 * - Low: Orange (#f97316) - Underperforming, needs attention
 * - Mid: Warm Cream (#fef3c7) - Average, neutral
 * - High: Indigo (#6366f1) - Outperforming, strong (brand primary)
 */

export type MapType = "level" | "growth" | "deviation"

/**
 * Smooth gradient color stops
 * Orange (warm) → Cream (neutral) → Indigo (cool)
 * Matches house chart colors for visual coherence
 */
const GRADIENT_COLORS = {
  light: {
    low: "#f97316",    // Orange - "underperforming" (matches chart palette)
    mid: "#fef3c7",    // Warm cream - "average" (neutral but not grey)
    high: "#6366f1",   // Indigo - "outperforming" (brand primary)
  },
  dark: {
    low: "#fb923c",    // Lighter orange for dark mode
    mid: "#fef9c3",    // Slightly brighter cream for dark mode
    high: "#818cf8",   // Lighter indigo for dark mode
  },
  nodata: {
    light: "#d1d5db",  // Grey - ONLY for missing data
    dark: "#4b5563",
  }
}

/**
 * Metrics where LOWER values are BETTER (should be inverted on the color scale)
 * For these, low value = indigo (good), high value = orange (bad)
 */
export const LOWER_IS_BETTER_METRICS = new Set<string>([
  "unemployment_rate_pct",
  // Add other metrics where lower is better here
])

/**
 * Check if a metric should have its color scale inverted
 * (i.e., lower values should appear as "good"/indigo)
 */
export function isLowerBetterMetric(metricId: string): boolean {
  return LOWER_IS_BETTER_METRICS.has(metricId)
}

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ]
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }).join("")
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1)
  const [r2, g2, b2] = hexToRgb(color2)
  return rgbToHex(
    lerp(r1, r2, t),
    lerp(g1, g2, t),
    lerp(b1, b2, t)
  )
}

/**
 * Get gradient colors for current theme
 */
function getGradientColors(): { low: string; mid: string; high: string; nodata: string } {
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  return {
    low: isDark ? GRADIENT_COLORS.dark.low : GRADIENT_COLORS.light.low,
    mid: isDark ? GRADIENT_COLORS.dark.mid : GRADIENT_COLORS.light.mid,
    high: isDark ? GRADIENT_COLORS.dark.high : GRADIENT_COLORS.light.high,
    nodata: isDark ? GRADIENT_COLORS.nodata.dark : GRADIENT_COLORS.nodata.light,
  }
}

/**
 * Legacy type export for backwards compatibility
 */
export const DIVERGING_GROWTH_METRICS = new Set<string>([
  "population_total",
  "population_16_64",
  "emp_total_jobs",
  "employment_rate_pct",
  "unemployment_rate_pct",
  "nominal_gva_mn_gbp",
  "gdhi_per_head_gbp",
])

export function getGrowthMapType(metricId: string): MapType {
  return "level"
}

interface MapColorScaleOptions {
  mapType: MapType
  value: number | null
  domain: [number, number]
  midpoint?: number
  percentiles?: QuintilePercentiles | null
  /** If true, invert the color scale (low = indigo, high = orange) */
  invert?: boolean
}

export interface QuintilePercentiles {
  p20: number
  p40: number
  p60: number
  p80: number
}

/**
 * Get color for a map value using smooth interpolation
 * 
 * Creates a continuous gradient from orange (low) → cream (mid) → indigo (high)
 * If invert=true, reverses: indigo (low) → cream (mid) → orange (high)
 * 
 * @param options - Map color scale options
 * @returns Color string (hex format for Mapbox compatibility)
 */
export function getMapColorForValue(options: MapColorScaleOptions): string {
  const { value, domain, invert = false } = options
  const colors = getGradientColors()
  
  // No data → grey
  if (value === null || value === undefined || !isFinite(value)) {
    return colors.nodata
  }
  
  const [min, max] = domain
  
  // Handle edge cases
  if (min === max) {
    return colors.mid // All same = average
  }
  
  // Normalize value to 0-1 range
  let t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  
  // Invert if needed (for metrics where lower is better)
  if (invert) {
    t = 1 - t
  }
  
  // Two-segment gradient: low→mid (0-0.5), mid→high (0.5-1)
  if (t <= 0.5) {
    // Orange → Cream (0 to 0.5 maps to 0 to 1)
    return interpolateColor(colors.low, colors.mid, t * 2)
  } else {
    // Cream → Indigo (0.5 to 1 maps to 0 to 1)
    return interpolateColor(colors.mid, colors.high, (t - 0.5) * 2)
  }
}

/**
 * Build a Mapbox GL JS interpolate expression for smooth gradient coloring
 * 
 * Creates continuous color transitions:
 * min → orange, median → cream, max → indigo
 * 
 * If invert=true, reverses:
 * min → indigo, median → cream, max → orange
 * 
 * @param mapType - Ignored (unified scale)
 * @param domain - [min, max] value range
 * @param midpoint - Optional midpoint (defaults to median)
 * @param percentiles - Optional percentile data (used for median if available)
 * @param invert - If true, invert the color scale (for metrics where lower is better)
 */
export function buildMapboxColorRamp(
  mapType: MapType,
  domain: [number, number],
  midpoint?: number,
  percentiles?: { 
    p5?: number
    p10?: number
    p15?: number
    p20?: number
    p25?: number
    p35?: number
    p40?: number
    p50?: number
    p60?: number
    p65?: number
    p75?: number
    p80?: number
    p85?: number
    p90?: number
    p95?: number
  } | null,
  invert?: boolean
): any[] {
  const [min, max] = domain
  const colors = getGradientColors()
  
  // Calculate midpoint (median if available, otherwise arithmetic mean)
  const mid = percentiles?.p50 ?? midpoint ?? (min + max) / 2
  
  // Choose colors based on inversion
  const lowColor = invert ? colors.high : colors.low   // Invert: low value = indigo
  const midColor = colors.mid                           // Always cream in middle
  const highColor = invert ? colors.low : colors.high  // Invert: high value = orange
  
  // Smooth interpolate expression
  return [
    "interpolate",
    ["linear"],
    ["to-number", ["get", "value"]],
    min, lowColor,    // Low value color
    mid, midColor,    // Average
    max, highColor,   // High value color
  ]
}

/**
 * Get legend configuration for the smooth gradient scale
 */
export function getQuintileLegend(invert?: boolean): Array<{ label: string; color: string; description: string }> {
  const colors = getGradientColors()
  
  if (invert) {
    // Inverted: high value = bad (orange), low value = good (indigo)
    return [
      { label: "Low", color: colors.high, description: "Outperforming" },
      { label: "Average", color: colors.mid, description: "Average" },
      { label: "High", color: colors.low, description: "Underperforming" },
    ]
  }
  
  return [
    { label: "High", color: colors.high, description: "Outperforming" },
    { label: "Average", color: colors.mid, description: "Average" },
    { label: "Low", color: colors.low, description: "Underperforming" },
  ]
}

/**
 * Calculate quintile percentiles from an array of values
 */
export function calculateQuintilePercentiles(values: number[]): QuintilePercentiles {
  const sorted = [...values].filter(v => isFinite(v)).sort((a, b) => a - b)
  const n = sorted.length
  
  if (n === 0) {
    return { p20: 0, p40: 0, p60: 0, p80: 0 }
  }
  
  const percentile = (p: number) => {
    const index = (p / 100) * (n - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }
  
  return {
    p20: percentile(20),
    p40: percentile(40),
    p60: percentile(60),
    p80: percentile(80),
  }
}
