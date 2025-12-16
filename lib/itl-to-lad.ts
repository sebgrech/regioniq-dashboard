// ITL to LAD mapping utilities
// @ts-ignore - JSON import
import itlToLadData from "@/public/processed/itl_to_lad.json"

interface ITLToLadMapping {
  ITL1: Record<string, string[]>
  ITL2: Record<string, string[]>
  ITL3: Record<string, string[]>
}

const mapping = itlToLadData as ITLToLadMapping

// ITL1 codes in `itl_to_lad.json` are TL* group codes (e.g. "TLK"), but the app uses UK* codes
// (e.g. "UKK") throughout UI + config. Keep a local bijection.
const TL_TO_UK: Record<string, string> = {
  TLC: "UKC", // North East
  TLD: "UKD", // North West
  TLE: "UKE", // Yorkshire and The Humber
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

const UK_TO_TL: Record<string, string> = Object.entries(TL_TO_UK).reduce(
  (acc, [tl, uk]) => {
    acc[uk] = tl
    return acc
  },
  {} as Record<string, string>
)

// -----------------------------------------------------------------------------
// Inverted helpers (LAD -> ITL*)
// -----------------------------------------------------------------------------

// Build once at module load. Size is small enough to keep in-memory.
const LAD_TO_ITL1: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const [itl1, lads] of Object.entries(mapping.ITL1 ?? {})) {
    for (const lad of lads ?? []) {
      if (!lad) continue
      m.set(lad, itl1)
    }
  }
  return m
})()

function mode<T extends string>(values: T[]): T | null {
  if (!values.length) return null
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: { v: T; n: number } | null = null
  for (const [v, n] of counts.entries()) {
    if (!best || n > best.n) best = { v, n }
  }
  return best?.v ?? null
}

/**
 * Get ITL1 parent for a LAD code (e.g. "E06000052" -> "UKK")
 */
export function getITL1ForLad(ladCode: string): string | null {
  const tl = LAD_TO_ITL1.get(ladCode) ?? null
  if (!tl) return null
  return TL_TO_UK[tl] ?? null
}

/**
 * Get ITL1 parent for an ITL2 code by mapping its LAD set to an ITL1 (mode).
 */
export function getITL1ForITL2(itl2Code: string): string | null {
  const lads = getLadsForITL2(itl2Code)
  const parents = lads.map((l) => LAD_TO_ITL1.get(l)).filter(Boolean) as string[]
  const tl = mode(parents)
  if (!tl) return null
  return TL_TO_UK[tl] ?? null
}

/**
 * Get ITL1 parent for an ITL3 code by mapping its LAD set to an ITL1 (mode).
 */
export function getITL1ForITL3(itl3Code: string): string | null {
  const lads = getLadsForITL3(itl3Code)
  const parents = lads.map((l) => LAD_TO_ITL1.get(l)).filter(Boolean) as string[]
  const tl = mode(parents)
  if (!tl) return null
  return TL_TO_UK[tl] ?? null
}

/**
 * Get all LAD codes for an ITL1 region
 * @param itl1Code - ITL1 code (e.g., "UKD", "UKI")
 * @returns Array of LAD codes
 */
export function getLadsForITL1(itl1Code: string): string[] {
  // Accept either app UI code (UK*) or mapping code (TL*)
  const tl = itl1Code.startsWith("UK") ? (UK_TO_TL[itl1Code] ?? itl1Code) : itl1Code
  return mapping.ITL1[tl] || []
}

/**
 * Get all LAD codes for an ITL2 region
 * @param itl2Code - ITL2 code (e.g., "TLD3", "TLG3")
 * @returns Array of LAD codes
 */
export function getLadsForITL2(itl2Code: string): string[] {
  return mapping.ITL2[itl2Code] || []
}

/**
 * Get all LAD codes for an ITL3 region
 * @param itl3Code - ITL3 code (e.g., "TLD33", "TLD34")
 * @returns Array of LAD codes
 */
export function getLadsForITL3(itl3Code: string): string[] {
  return mapping.ITL3[itl3Code] || []
}

/**
 * Get all LAD codes for an ITL region at any level
 * @param itlCode - ITL code (ITL1, ITL2, or ITL3)
 * @param level - Region level
 * @returns Array of LAD codes
 */
export function getLadsForITL(
  itlCode: string,
  level: "ITL1" | "ITL2" | "ITL3"
): string[] {
  switch (level) {
    case "ITL1":
      return getLadsForITL1(itlCode)
    case "ITL2":
      return getLadsForITL2(itlCode)
    case "ITL3":
      return getLadsForITL3(itlCode)
    default:
      return []
  }
}

/**
 * Check if an ITL code exists in the mapping
 * @param itlCode - ITL code to check
 * @param level - Region level
 * @returns True if code exists
 */
export function hasITLMapping(itlCode: string, level: "ITL1" | "ITL2" | "ITL3"): boolean {
  const lads = getLadsForITL(itlCode, level)
  return lads.length > 0
}

