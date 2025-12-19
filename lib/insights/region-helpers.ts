/**
 * Region Helper Functions
 * 
 * Functions to determine peer regions and parent relationships.
 * Used by the insight engine to compute comparisons.
 */

import { REGIONS, type Region } from "@/lib/metrics.config"

// ITL code patterns:
// - ITL1: UK[C-N] (e.g., UKI for London)
// - ITL2: TL[A-Z][0-9] (e.g., TLI3 for Inner London - West)
// - ITL3: TL[A-Z][0-9][0-9] (e.g., TLI33 for Kensington & Chelsea)

// TL prefix to UK prefix mapping (for ITL1)
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

export type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

/**
 * Detect the level of a region code
 */
export function detectRegionLevel(code: string): RegionLevel | null {
  // ITL1: UK[C-N] (3 chars)
  if (code.match(/^UK[C-N]$/)) return "ITL1"
  
  // ITL2: TL[A-Z][0-9] (4 chars)
  if (code.match(/^TL[A-Z][0-9]$/)) return "ITL2"
  
  // ITL3: TL[A-Z][0-9][0-9] (5 chars)
  if (code.match(/^TL[A-Z][0-9]{2}$/)) return "ITL3"
  
  // LAD: E[0-9]+, W[0-9]+, S[0-9]+, N[0-9]+
  if (code.match(/^[EWSN][0-9]+$/)) return "LAD"
  
  return null
}

export interface ParentRegion {
  code: string
  name: string
  level: RegionLevel
}

/**
 * Get the parent region for a given region code
 * 
 * ITL3 → ITL2 → ITL1
 * ITL1 has no parent (national level)
 */
export function getParentRegion(regionCode: string): ParentRegion | null {
  const level = detectRegionLevel(regionCode)
  
  if (!level) return null
  
  switch (level) {
    case "ITL3": {
      // ITL3 parent is ITL2: TLI33 → TLI3
      const parentCode = regionCode.slice(0, 4)
      const parent = REGIONS.find(r => r.code === parentCode && r.level === "ITL2")
      return parent ? { code: parent.code, name: parent.name, level: "ITL2" } : null
    }
    
    case "ITL2": {
      // ITL2 parent is ITL1: TLI3 → TLI → UKI
      const tlPrefix = regionCode.slice(0, 3) // TLI
      const ukCode = TL_TO_UK[tlPrefix]
      if (!ukCode) return null
      const parent = REGIONS.find(r => r.code === ukCode && r.level === "ITL1")
      return parent ? { code: parent.code, name: parent.name, level: "ITL1" } : null
    }
    
    case "ITL1":
    case "LAD":
      // ITL1 has no parent (national is implicit)
      // LAD parent handling would need the itl-to-lad mapping
      return null
    
    default:
      return null
  }
}

/**
 * Get the grandparent region (ITL1) for any region
 */
export function getITL1Parent(regionCode: string): ParentRegion | null {
  const level = detectRegionLevel(regionCode)
  
  if (!level) return null
  
  if (level === "ITL1") {
    // Already ITL1, return itself
    const region = REGIONS.find(r => r.code === regionCode && r.level === "ITL1")
    return region ? { code: region.code, name: region.name, level: "ITL1" } : null
  }
  
  if (level === "ITL2") {
    return getParentRegion(regionCode)
  }
  
  if (level === "ITL3") {
    // Go up two levels
    const itl2 = getParentRegion(regionCode)
    if (!itl2) return null
    return getParentRegion(itl2.code)
  }
  
  return null
}

/**
 * Get all peer regions (same level, same parent)
 * 
 * For ITL3: All ITL3s sharing the same ITL2 parent
 * For ITL2: All ITL2s sharing the same ITL1 parent
 * For ITL1: All ITL1 regions (national peers)
 */
export function getPeerRegions(regionCode: string): Region[] {
  const level = detectRegionLevel(regionCode)
  
  if (!level) return []
  
  switch (level) {
    case "ITL3": {
      // Peers are ITL3s with same ITL2 parent
      const parentCode = regionCode.slice(0, 4) // TLI33 → TLI3
      return REGIONS.filter(
        r => r.level === "ITL3" && 
             r.code.startsWith(parentCode) && 
             r.code !== regionCode
      )
    }
    
    case "ITL2": {
      // Peers are ITL2s with same ITL1 parent (same TL prefix)
      const tlPrefix = regionCode.slice(0, 3) // TLI3 → TLI
      return REGIONS.filter(
        r => r.level === "ITL2" && 
             r.code.startsWith(tlPrefix) && 
             r.code !== regionCode
      )
    }
    
    case "ITL1": {
      // Peers are all other ITL1 regions
      return REGIONS.filter(
        r => r.level === "ITL1" && r.code !== regionCode
      )
    }
    
    default:
      return []
  }
}

/**
 * Get peer region codes (convenience function)
 */
export function getPeerRegionCodes(regionCode: string): string[] {
  return getPeerRegions(regionCode).map(r => r.code)
}

/**
 * Get a human-readable peer group label
 * 
 * Examples:
 * - TLI33 → "Inner London - West ITL3 regions"
 * - TLI3 → "London ITL2 regions"
 * - UKI → "ITL1 regions"
 */
export function getPeerGroupLabel(regionCode: string): string {
  const level = detectRegionLevel(regionCode)
  const peers = getPeerRegions(regionCode)
  const peerCount = peers.length + 1 // Include self
  
  if (!level) return "regions"
  
  switch (level) {
    case "ITL3": {
      const parent = getParentRegion(regionCode)
      return parent 
        ? `${peerCount} ${parent.name} sub-regions`
        : `${peerCount} ITL3 regions`
    }
    
    case "ITL2": {
      const parent = getParentRegion(regionCode)
      return parent 
        ? `${peerCount} ${parent.name} sub-regions`
        : `${peerCount} ITL2 regions`
    }
    
    case "ITL1": {
      return `${peerCount} UK regions`
    }
    
    default:
      return "regions"
  }
}

/**
 * Get region name by code
 */
export function getRegionName(regionCode: string): string {
  const region = REGIONS.find(r => r.code === regionCode)
  return region?.name ?? regionCode
}

/**
 * Get full region info by code
 */
export function getRegion(regionCode: string): Region | undefined {
  return REGIONS.find(r => r.code === regionCode)
}


