export type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

// Must match the `Layer id`s used by `MapOverlaysDynamic`.
//
// IMPORTANT:
// This list must remain constant and include ALL region fill layers.
// Do NOT make interactivity conditional on `level` (it can silently break hit-testing after level switches).
// See: map interactivity invariants.
//
// Freeze to reduce the chance of accidental runtime mutation.
export const INTERACTIVE_LAYER_IDS = Object.freeze([
  "itl1-fill",
  "itl2-fill",
  "itl3-fill",
  "lad-fill",
]) as readonly ["itl1-fill", "itl2-fill", "itl3-fill", "lad-fill"]

export const SOURCE_ID = "dynamic-geojson-src" as const

export function fillLayerId(level: RegionLevel) {
  return `${level.toLowerCase()}-fill` as const
}

export const PROPERTY_MAP: Record<RegionLevel, { code: string; name: string }> = {
  ITL1: { code: "ITL125CD", name: "ITL125NM" },
  ITL2: { code: "ITL225CD", name: "ITL225NM" }, // 2025 codes
  ITL3: { code: "ITL325CD", name: "ITL325NM" },
  LAD: { code: "LAD24CD", name: "LAD24NM" },
}

// ITL125CD (TL*) -> UK slug
export const TL_TO_UK: Record<string, string> = {
  TLC: "UKC", // North East
  TLD: "UKD", // North West
  TLE: "UKE", // Yorkshire & Humber
  TLF: "UKF", // East Midlands
  TLG: "UKG", // West Midlands
  TLH: "UKH", // East of England
  TLI: "UKI", // London
  TLJ: "UKJ", // South East
  TLK: "UKK", // South West
  TLL: "UKL", // Wales
  TLM: "UKM", // Scotland
  TLN: "UKN", // Northern Ireland
}

// ITL3 old GeoJSON codes -> new database codes mapping
export const ITL3_OLD_TO_NEW: Record<string, string> = {
  TLE32: "TLE36", // Sheffield
}

/**
 * Convert a GeoJSON feature code into the canonical region code used by the app / region-index.json.
 * - ITL1: TL* -> UK*
 * - ITL3: known old -> new remaps (e.g. Sheffield)
 * - ITL2/LAD: pass-through
 */
export function canonicalRegionCode(level: RegionLevel, featureCode: string | undefined | null) {
  if (!featureCode) return null
  if (level === "ITL1") return TL_TO_UK[featureCode] ?? featureCode
  if (level === "ITL3") return ITL3_OLD_TO_NEW[featureCode] ?? featureCode
  return featureCode
}


