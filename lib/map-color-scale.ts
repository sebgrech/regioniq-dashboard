/**
 * Map Color Scale Utility
 * 
 * Centralized semantic color system for map visualizations.
 * 
 * Core principles:
 * - Maps are analytical surfaces, not UI chrome
 * - Map colors encode state, not action
 * - Never reuse UI (--primary, --secondary, --accent) or chart (--chart-*) tokens
 * - Each color has exactly one semantic meaning
 * 
 * Semantic meanings (locked):
 * - Grey = no data / absence of signal
 * - Very light grey = neutral / near-zero (midpoint in diverging scales)
 * - Blue = stronger / higher / outperforming (calm, analytical)
 * - Muted red/orange = weaker / lower / underperforming (desaturated, never alarmist)
 * 
 * Map Types:
 * - Type A (levels): Sequential blue scale for absolute values
 * - Type B (growth): Diverging scale for growth/change/deltas (negative → neutral → positive)
 * - Type C (deviation): Same diverging scale for relative position vs benchmark
 */

export type MapType = "level" | "growth" | "deviation"

interface MapColorScaleOptions {
  mapType: MapType
  value: number | null
  domain: [number, number] // [min, max]
  midpoint?: number // For diverging scales (default: 0 for growth, domain midpoint for deviation)
}

/**
 * Get map color from CSS custom properties
 * Falls back to computed values if CSS variables aren't available
 */
function getMapColor(token: string): string {
  if (typeof window === "undefined") {
    // SSR fallback - return OKLCH values directly
    const isDark = false // Default to light mode for SSR
    const colors: Record<string, string> = {
      "map-nodata": isDark ? "oklch(0.25 0 0)" : "oklch(0.85 0 0)",
      "map-neutral": isDark ? "oklch(0.30 0 0)" : "oklch(0.92 0 0)",
      "map-positive": isDark ? "oklch(0.60 0.12 240)" : "oklch(0.55 0.12 240)",
      "map-positive-light": isDark ? "oklch(0.50 0.08 240)" : "oklch(0.75 0.08 240)",
      "map-positive-mid": isDark ? "oklch(0.55 0.10 240)" : "oklch(0.65 0.10 240)",
      "map-positive-dark": isDark ? "oklch(0.65 0.14 240)" : "oklch(0.45 0.14 240)",
      "map-negative": isDark ? "oklch(0.55 0.12 35)" : "oklch(0.60 0.12 35)",
      "map-negative-light": isDark ? "oklch(0.45 0.08 35)" : "oklch(0.75 0.08 35)",
      "map-negative-mid": isDark ? "oklch(0.50 0.10 35)" : "oklch(0.65 0.10 35)",
      "map-negative-dark": isDark ? "oklch(0.60 0.14 35)" : "oklch(0.50 0.14 35)",
    }
    return colors[token] || "oklch(0.85 0 0)"
  }
  
  // Client-side: get from CSS custom property
  const root = document.documentElement
  const value = getComputedStyle(root).getPropertyValue(`--map-${token}`).trim()
  
  if (value) {
    return value
  }
  
  // Fallback if CSS variable not found
  const isDark = root.classList.contains("dark")
  const fallbacks: Record<string, string> = {
    "nodata": isDark ? "oklch(0.25 0 0)" : "oklch(0.85 0 0)",
    "neutral": isDark ? "oklch(0.30 0 0)" : "oklch(0.92 0 0)",
    "positive": isDark ? "oklch(0.60 0.12 240)" : "oklch(0.55 0.12 240)",
    "positive-light": isDark ? "oklch(0.50 0.08 240)" : "oklch(0.75 0.08 240)",
    "positive-mid": isDark ? "oklch(0.55 0.10 240)" : "oklch(0.65 0.10 240)",
    "positive-dark": isDark ? "oklch(0.65 0.14 240)" : "oklch(0.45 0.14 240)",
    "negative": isDark ? "oklch(0.55 0.12 35)" : "oklch(0.60 0.12 35)",
    "negative-light": isDark ? "oklch(0.45 0.08 35)" : "oklch(0.75 0.08 35)",
    "negative-mid": isDark ? "oklch(0.50 0.10 35)" : "oklch(0.65 0.10 35)",
    "negative-dark": isDark ? "oklch(0.60 0.14 35)" : "oklch(0.50 0.14 35)",
  }
  return fallbacks[token] || fallbacks.nodata
}

/**
 * Map color token names to hex values
 * These hex values are approximations of the OKLCH colors defined in globals.css
 * They maintain the semantic meaning while being compatible with Mapbox GL JS
 * 
 * Semantic mapping:
 * - nodata: Grey for no data / absence of signal
 * - neutral: Very light grey for near-zero / midpoint
 * - positive: Blue for stronger / higher / outperforming
 * - negative: Muted red-orange for weaker / lower / underperforming
 */
const MAP_COLOR_HEX: Record<string, { light: string; dark: string }> = {
  "nodata": { light: "#d1d5db", dark: "#4b5563" }, // Grey - aligns with muted/disabled
  "neutral": { light: "#f3f4f6", dark: "#6b7280" }, // Very light grey - visually recedes
  "positive": { light: "#3b82f6", dark: "#60a5fa" }, // Deep analytical blue
  "positive-light": { light: "#93c5fd", dark: "#3b82f6" }, // Light blue
  "positive-mid": { light: "#60a5fa", dark: "#3b82f6" }, // Mid blue
  "positive-dark": { light: "#1e40af", dark: "#93c5fd" }, // Dark blue
  "negative": { light: "#f97316", dark: "#fb923c" }, // Muted red-orange
  "negative-light": { light: "#fdba74", dark: "#f97316" }, // Light red-orange
  "negative-mid": { light: "#fb923c", dark: "#f97316" }, // Mid red-orange
  "negative-dark": { light: "#c2410c", dark: "#fdba74" }, // Dark red-orange
}

/**
 * Convert color token to hex (for Mapbox GL JS compatibility)
 * Accepts either a token name (e.g., "positive") or an OKLCH string
 */
function tokenToHex(tokenOrOklch: string): string {
  // If already hex, return as-is
  if (tokenOrOklch.startsWith("#")) return tokenOrOklch
  
  // Check if it's a token name directly
  if (MAP_COLOR_HEX[tokenOrOklch]) {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark")
    return isDark ? MAP_COLOR_HEX[tokenOrOklch].dark : MAP_COLOR_HEX[tokenOrOklch].light
  }
  
  // Try to extract token from OKLCH string or CSS variable
  const tokenMatch = tokenOrOklch.match(/map-(\w+)/) || tokenOrOklch.match(/(\w+)/)
  if (tokenMatch && MAP_COLOR_HEX[tokenMatch[1]]) {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark")
    return isDark ? MAP_COLOR_HEX[tokenMatch[1]].dark : MAP_COLOR_HEX[tokenMatch[1]].light
  }
  
  return "#9ca3af" // Fallback grey
}

/**
 * Get color for a map value based on map type and domain
 * 
 * @param options - Map color scale options
 * @returns Color string (hex format for Mapbox compatibility)
 */
export function getMapColorForValue(options: MapColorScaleOptions): string {
  const { mapType, value, domain, midpoint } = options
  
  // No data → grey
  if (value === null || value === undefined || !isFinite(value)) {
    return tokenToHex("nodata")
  }
  
  const [min, max] = domain
  
  // Handle edge cases
  if (min === max) {
    // All values are the same - use neutral grey
    return tokenToHex("neutral")
  }
  
  switch (mapType) {
    case "level": {
      // Type A: Sequential blue scale (light → dark)
      // Single hue only, no red, no green
      const normalized = (value - min) / (max - min)
      const clamped = Math.max(0, Math.min(1, normalized))
      
      if (clamped < 0.2) {
        return tokenToHex("positive-light")
      } else if (clamped < 0.4) {
        return tokenToHex("positive-mid")
      } else if (clamped < 0.7) {
        return tokenToHex("positive")
      } else {
        return tokenToHex("positive-dark")
      }
    }
    
    case "growth":
    case "deviation": {
      // Type B & C: Diverging scale (negative → neutral → positive)
      // Symmetric around midpoint
      const mid = midpoint ?? (mapType === "growth" ? 0 : (min + max) / 2)
      
      if (value < mid) {
        // Negative side: muted red/orange
        const negRange = mid - min
        if (negRange === 0) {
          return tokenToHex("neutral")
        }
        const negPos = (mid - value) / negRange
        const clamped = Math.max(0, Math.min(1, negPos))
        
        if (clamped < 0.3) {
          return tokenToHex("negative-light")
        } else if (clamped < 0.6) {
          return tokenToHex("negative-mid")
        } else if (clamped < 0.85) {
          return tokenToHex("negative")
        } else {
          return tokenToHex("negative-dark")
        }
      } else if (value === mid) {
        // Exactly at midpoint → neutral grey
        return tokenToHex("neutral")
      } else {
        // Positive side: blue
        const posRange = max - mid
        if (posRange === 0) {
          return tokenToHex("neutral")
        }
        const posPos = (value - mid) / posRange
        const clamped = Math.max(0, Math.min(1, posPos))
        
        if (clamped < 0.3) {
          return tokenToHex("positive-light")
        } else if (clamped < 0.6) {
          return tokenToHex("positive-mid")
        } else if (clamped < 0.85) {
          return tokenToHex("positive")
        } else {
          return tokenToHex("positive-dark")
        }
      }
    }
  }
}

/**
 * Build a Mapbox GL JS interpolate expression for color ramps
 * Returns an expression array that can be used directly in Mapbox layer paint properties
 * 
 * @param mapType - Type of map (level, growth, deviation)
 * @param domain - [min, max] value range
 * @param midpoint - Optional midpoint for diverging scales (default: 0 for growth, domain midpoint for deviation)
 * @param percentiles - Optional percentile stops for better proportionality (p10, p25, p50, p75, p90)
 */
export function buildMapboxColorRamp(
  mapType: MapType,
  domain: [number, number],
  midpoint?: number,
  percentiles?: { 
    p5?: number; 
    p10?: number; 
    p15?: number; 
    p25?: number; 
    p35?: number; 
    p50?: number; 
    p65?: number; 
    p75?: number; 
    p85?: number; 
    p90?: number; 
    p95?: number; 
  } | null
): any[] {
  const mid = midpoint ?? (mapType === "growth" ? 0 : (domain[0] + domain[1]) / 2)
  const [min, max] = domain
  
  if (mapType === "level") {
    // Sequential blue scale
    let stops: [number, string][]
    
    if (percentiles && (isFinite(percentiles.p5) || isFinite(percentiles.p10))) {
      // AGGRESSIVE percentile-based stops for maximum visual variation
      // Creates many color transitions to highlight differences even in narrow ranges
      const range = max - min
      // Very small minimum difference - allows more stops for maximum granularity
      const minDiff = Math.max(range * 0.002, 0.005) // Minimum 0.2% of range or 0.005, whichever is larger
      
      stops = [
        [min, tokenToHex("positive-light")],
      ]
      
      // Add many percentile stops with AGGRESSIVE color transitions
      // Use all 4 color levels (light, mid, positive, dark) more aggressively
      // This creates maximum visual heterogeneity by forcing color changes at many points
      const percentileStops: Array<{ value: number; color: string }> = []
      
      // Bottom tier: light blue
      if (percentiles.p5 && isFinite(percentiles.p5) && percentiles.p5 > min) {
        percentileStops.push({ value: percentiles.p5, color: tokenToHex("positive-light") })
      }
      if (percentiles.p10 && isFinite(percentiles.p10)) {
        percentileStops.push({ value: percentiles.p10, color: tokenToHex("positive-light") })
      }
      
      // Lower-mid tier: mid blue (transition starts early)
      if (percentiles.p15 && isFinite(percentiles.p15)) {
        percentileStops.push({ value: percentiles.p15, color: tokenToHex("positive-mid") })
      }
      if (percentiles.p25 && isFinite(percentiles.p25)) {
        percentileStops.push({ value: percentiles.p25, color: tokenToHex("positive-mid") })
      }
      
      // Mid tier: standard blue
      if (percentiles.p35 && isFinite(percentiles.p35)) {
        percentileStops.push({ value: percentiles.p35, color: tokenToHex("positive") })
      }
      if (percentiles.p50 && isFinite(percentiles.p50)) {
        percentileStops.push({ value: percentiles.p50, color: tokenToHex("positive") })
      }
      
      // Upper-mid tier: transition to dark (starts earlier)
      if (percentiles.p65 && isFinite(percentiles.p65)) {
        percentileStops.push({ value: percentiles.p65, color: tokenToHex("positive") })
      }
      if (percentiles.p75 && isFinite(percentiles.p75)) {
        percentileStops.push({ value: percentiles.p75, color: tokenToHex("positive-dark") })
      }
      
      // Top tier: dark blue (most aggressive)
      if (percentiles.p85 && isFinite(percentiles.p85)) {
        percentileStops.push({ value: percentiles.p85, color: tokenToHex("positive-dark") })
      }
      if (percentiles.p90 && isFinite(percentiles.p90)) {
        percentileStops.push({ value: percentiles.p90, color: tokenToHex("positive-dark") })
      }
      if (percentiles.p95 && isFinite(percentiles.p95) && percentiles.p95 < max) {
        percentileStops.push({ value: percentiles.p95, color: tokenToHex("positive-dark") })
      }
      
      // Add stops with minimum spacing
      for (const { value, color } of percentileStops) {
        if (value > stops[stops.length - 1][0] + minDiff) {
          stops.push([value, color])
        }
      }
      
      // Ensure max is included
      if (max > stops[stops.length - 1][0] + minDiff) {
        stops.push([max, tokenToHex("positive-dark")])
      } else {
        // Update last stop to max if too close
        stops[stops.length - 1][0] = max
      }
    } else {
      // Fallback to linear stops
      stops = [
        [min, tokenToHex("positive-light")],
        [min + (max - min) * 0.2, tokenToHex("positive-mid")],
        [min + (max - min) * 0.4, tokenToHex("positive")],
        [min + (max - min) * 0.7, tokenToHex("positive-dark")],
        [max, tokenToHex("positive-dark")],
      ]
    }
    
    // Sort and deduplicate stops (Mapbox requirement)
    stops.sort((a, b) => a[0] - b[0])
    const uniqueStops: [number, string][] = []
    let lastValue = -Infinity
    for (const [val, color] of stops) {
      if (val !== lastValue) {
        uniqueStops.push([val, color])
        lastValue = val
      }
    }
    
    if (uniqueStops.length < 2) {
      return ["literal", tokenToHex("neutral")]
    }
    
    return [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "value"]],
      ...uniqueStops.flat(),
    ]
  } else {
    // Diverging scale
    const stops: [number, string][] = []
    
    // Negative side
    if (min < mid) {
      stops.push([min, tokenToHex("negative-dark")])
      stops.push([min + (mid - min) * 0.3, tokenToHex("negative-mid")])
      stops.push([min + (mid - min) * 0.6, tokenToHex("negative")])
      stops.push([min + (mid - min) * 0.85, tokenToHex("negative-light")])
    }
    
    // Midpoint
    stops.push([mid, tokenToHex("neutral")])
    
    // Positive side
    if (max > mid) {
      stops.push([mid + (max - mid) * 0.15, tokenToHex("positive-light")])
      stops.push([mid + (max - mid) * 0.4, tokenToHex("positive-mid")])
      stops.push([mid + (max - mid) * 0.7, tokenToHex("positive")])
      stops.push([max, tokenToHex("positive-dark")])
    }
    
    // Sort stops by value (Mapbox requirement)
    stops.sort((a, b) => a[0] - b[0])
    
    // Remove duplicates
    const uniqueStops: [number, string][] = []
    let lastValue = -Infinity
    for (const [val, color] of stops) {
      if (val !== lastValue) {
        uniqueStops.push([val, color])
        lastValue = val
      }
    }
    
    // Mapbox requires at least 2 stops
    if (uniqueStops.length < 2) {
      return ["literal", tokenToHex("neutral")]
    }
    
    return [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "value"]],
      ...uniqueStops.flat(),
    ]
  }
}

