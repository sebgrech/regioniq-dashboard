/**
 * Region Hierarchy Utilities
 * 
 * Auto-find related regions (parents, children, siblings) using the master
 * geography lookup data. This provides a unified, data-driven approach to
 * region discovery without hardcoding relationships.
 * 
 * Generated from: master_2025_geography_lookup.csv
 */

// @ts-ignore - JSON import
import hierarchyData from "@/public/processed/region-hierarchy.json"

// =============================================================================
// Types
// =============================================================================

export type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

export interface RegionInfo {
  code: string
  name: string
  level: RegionLevel
  parentCode: string | null
  parentName: string | null
  children: string[]
  siblings: string[]
  lads: string[]
}

interface RegionHierarchy {
  regions: Record<string, RegionInfo>
  byLevel: {
    ITL1: string[]
    ITL2: string[]
    ITL3: string[]
    LAD: string[]
  }
  parentToChildren: {
    ITL1ToITL2: Record<string, string[]>
    ITL2ToITL3: Record<string, string[]>
    ITL3ToLAD: Record<string, string[]>
  }
  meta: {
    generatedAt: string
    sourceFile: string
    totalRegions: number
  }
}

const hierarchy = hierarchyData as RegionHierarchy

// =============================================================================
// Core Lookup Functions
// =============================================================================

/**
 * Get region info by code
 * 
 * @example
 * getRegionInfo("TLD3") // { code: "TLD3", name: "Greater Manchester", level: "ITL2", ... }
 * getRegionInfo("UKI") // { code: "UKI", name: "London", level: "ITL1", ... }
 */
export function getRegionInfo(code: string): RegionInfo | null {
  return hierarchy.regions[code] ?? null
}

/**
 * Get region name by code
 * 
 * @example
 * getRegionNameByCode("TLD3") // "Greater Manchester"
 */
export function getRegionNameByCode(code: string): string | null {
  return hierarchy.regions[code]?.name ?? null
}

/**
 * Get region level by code
 * 
 * @example
 * getRegionLevelByCode("TLD3") // "ITL2"
 * getRegionLevelByCode("UKI") // "ITL1"
 */
export function getRegionLevelByCode(code: string): RegionLevel | null {
  return hierarchy.regions[code]?.level ?? null
}

/**
 * Check if a region code exists in the hierarchy
 */
export function hasRegion(code: string): boolean {
  return code in hierarchy.regions
}

// =============================================================================
// Parent Navigation
// =============================================================================

/**
 * Get the immediate parent region
 * 
 * @example
 * getParent("TLD33") // { code: "TLD3", name: "Greater Manchester" } (ITL3 → ITL2)
 * getParent("TLD3") // { code: "UKD", name: "North West (England)" } (ITL2 → ITL1)
 * getParent("UKD") // null (ITL1 has no parent)
 */
export function getParent(code: string): { code: string; name: string; level: RegionLevel } | null {
  const region = hierarchy.regions[code]
  if (!region?.parentCode) return null

  const parent = hierarchy.regions[region.parentCode]
  if (!parent) return null

  return {
    code: parent.code,
    name: parent.name,
    level: parent.level,
  }
}

/**
 * Get the ITL1 ancestor for any region
 * 
 * @example
 * getITL1Ancestor("TLD33") // { code: "UKD", name: "North West (England)" }
 * getITL1Ancestor("TLD3") // { code: "UKD", name: "North West (England)" }
 * getITL1Ancestor("UKD") // { code: "UKD", name: "North West (England)" }
 */
export function getITL1Ancestor(code: string): { code: string; name: string } | null {
  const region = hierarchy.regions[code]
  if (!region) return null

  if (region.level === "ITL1") {
    return { code: region.code, name: region.name }
  }

  // Walk up the tree
  let current = region
  while (current.parentCode) {
    const parent = hierarchy.regions[current.parentCode]
    if (!parent) break
    if (parent.level === "ITL1") {
      return { code: parent.code, name: parent.name }
    }
    current = parent
  }

  return null
}

/**
 * Get the ITL2 ancestor for any region (ITL3 or LAD)
 * 
 * @example
 * getITL2Ancestor("TLD33") // { code: "TLD3", name: "Greater Manchester" }
 * getITL2Ancestor("E08000003") // { code: "TLD3", name: "Greater Manchester" } (Manchester LAD)
 */
export function getITL2Ancestor(code: string): { code: string; name: string } | null {
  const region = hierarchy.regions[code]
  if (!region) return null

  if (region.level === "ITL2") {
    return { code: region.code, name: region.name }
  }

  if (region.level === "ITL1") {
    return null // ITL1 has no ITL2 ancestor
  }

  // Walk up the tree
  let current = region
  while (current.parentCode) {
    const parent = hierarchy.regions[current.parentCode]
    if (!parent) break
    if (parent.level === "ITL2") {
      return { code: parent.code, name: parent.name }
    }
    current = parent
  }

  return null
}

/**
 * Get full ancestry chain from region to ITL1
 * 
 * @example
 * getAncestryChain("TLD33") 
 * // [
 * //   { code: "TLD3", name: "Greater Manchester", level: "ITL2" },
 * //   { code: "UKD", name: "North West (England)", level: "ITL1" }
 * // ]
 */
export function getAncestryChain(code: string): Array<{ code: string; name: string; level: RegionLevel }> {
  const chain: Array<{ code: string; name: string; level: RegionLevel }> = []
  let current = hierarchy.regions[code]

  while (current?.parentCode) {
    const parent = hierarchy.regions[current.parentCode]
    if (!parent) break
    chain.push({ code: parent.code, name: parent.name, level: parent.level })
    current = parent
  }

  return chain
}

// =============================================================================
// Child Navigation
// =============================================================================

/**
 * Get immediate children of a region
 * 
 * @example
 * getChildren("UKD") // All ITL2s in North West
 * getChildren("TLD3") // All ITL3s in Greater Manchester
 */
export function getChildren(code: string): Array<{ code: string; name: string; level: RegionLevel }> {
  const region = hierarchy.regions[code]
  if (!region?.children?.length) return []

  return region.children
    .map(childCode => hierarchy.regions[childCode])
    .filter(Boolean)
    .map(child => ({
      code: child.code,
      name: child.name,
      level: child.level,
    }))
}

/**
 * Get all descendant region codes (children, grandchildren, etc.)
 * 
 * @example
 * getAllDescendants("UKD") // All ITL2s, ITL3s, and LADs in North West
 */
export function getAllDescendants(code: string): string[] {
  const descendants: string[] = []
  const queue = [code]

  while (queue.length > 0) {
    const current = queue.shift()!
    const region = hierarchy.regions[current]
    if (!region) continue

    for (const childCode of region.children ?? []) {
      descendants.push(childCode)
      queue.push(childCode)
    }
  }

  return descendants
}

/**
 * Get all LAD codes for any region
 * 
 * @example
 * getLADs("UKD") // All LADs in North West
 * getLADs("TLD3") // All LADs in Greater Manchester
 * getLADs("TLD33") // All LADs in Manchester ITL3
 */
export function getLADs(code: string): string[] {
  const region = hierarchy.regions[code]
  return region?.lads ?? []
}

// =============================================================================
// Sibling Navigation
// =============================================================================

/**
 * Get sibling regions (same parent, same level)
 * 
 * @example
 * getSiblings("TLD3") // All other ITL2s in North West
 * getSiblings("TLD33") // All other ITL3s in Greater Manchester
 */
export function getSiblings(code: string): Array<{ code: string; name: string }> {
  const region = hierarchy.regions[code]
  if (!region?.siblings?.length) return []

  return region.siblings
    .map(siblingCode => hierarchy.regions[siblingCode])
    .filter(Boolean)
    .map(sibling => ({
      code: sibling.code,
      name: sibling.name,
    }))
}

/**
 * Get sibling region codes
 */
export function getSiblingCodes(code: string): string[] {
  return hierarchy.regions[code]?.siblings ?? []
}

/**
 * Get peer LADs within the same ITL2 region (excluding self)
 * This is useful for comparing a LAD to other LADs in its economic region.
 * 
 * @example
 * getPeerLADsInSameITL2("E09000032") // Other LADs in Inner London - West (Wandsworth's ITL2)
 * // Returns: Kensington & Chelsea, Hammersmith & Fulham, Westminster, City of London, Camden
 */
export function getPeerLADsInSameITL2(ladCode: string): Array<{ code: string; name: string }> {
  const region = hierarchy.regions[ladCode]
  if (!region) return []
  
  // Find the ITL2 ancestor
  const itl2 = getITL2Ancestor(ladCode)
  if (!itl2) return []
  
  // Get all LADs in that ITL2
  const allLADsInITL2 = getLADs(itl2.code)
  
  // Filter out self and return with names
  return allLADsInITL2
    .filter(code => code !== ladCode)
    .map(code => hierarchy.regions[code])
    .filter(Boolean)
    .map(r => ({ code: r.code, name: r.name }))
}

/**
 * Get peer LADs for comparison, with automatic fallback to ITL1 if ITL2 has too few peers.
 * Returns at least `minPeers` LADs when possible.
 * 
 * Fallback logic:
 * 1. First try ITL2 peers (same economic sub-region)
 * 2. If fewer than minPeers, expand to ITL1 peers (same country/macro-region)
 * 
 * @example
 * getPeerLADsWithFallback("S12000033", 2) // Aberdeen City
 * // ITL2 (TLM5) only has Aberdeenshire, so falls back to Scottish ITL1 peers
 * // Returns: Aberdeenshire, Dundee City (or other Scottish LADs)
 */
export function getPeerLADsWithFallback(
  ladCode: string,
  minPeers: number = 2
): Array<{ code: string; name: string }> {
  const region = hierarchy.regions[ladCode]
  if (!region) return []

  // First try ITL2 peers
  const itl2Peers = getPeerLADsInSameITL2(ladCode)
  
  // If we have enough peers, return them
  if (itl2Peers.length >= minPeers) {
    return itl2Peers.slice(0, minPeers)
  }

  // Not enough ITL2 peers, fall back to ITL1
  const itl1 = getITL1Ancestor(ladCode)
  if (!itl1) return itl2Peers // Return what we have

  // Get all LADs in the ITL1 (same country/macro-region)
  const allLADsInITL1 = getLADs(itl1.code)
  
  // Filter out self and existing ITL2 peers, then add to fill the gap
  const itl2PeerCodes = new Set(itl2Peers.map(p => p.code))
  const additionalPeers = allLADsInITL1
    .filter(code => code !== ladCode && !itl2PeerCodes.has(code))
    .map(code => hierarchy.regions[code])
    .filter(Boolean)
    .map(r => ({ code: r.code, name: r.name }))

  // Combine ITL2 peers with additional ITL1 peers
  const combined = [...itl2Peers, ...additionalPeers]
  return combined.slice(0, minPeers)
}

/**
 * Get all regions at the same level with a shared ITL1 ancestor
 * (Useful for broader comparisons)
 * 
 * @example
 * getPeersInSameITL1("TLD3") // All ITL2s in North West (including siblings from other parents)
 */
export function getPeersInSameITL1(code: string): Array<{ code: string; name: string }> {
  const itl1 = getITL1Ancestor(code)
  if (!itl1) return []

  const region = hierarchy.regions[code]
  if (!region) return []

  // Get all regions at the same level under the same ITL1
  const level = region.level
  const allAtLevel = hierarchy.byLevel[level] ?? []

  return allAtLevel
    .filter(c => c !== code)
    .map(c => hierarchy.regions[c])
    .filter(r => r && getITL1Ancestor(r.code)?.code === itl1.code)
    .map(r => ({ code: r.code, name: r.name }))
}

// =============================================================================
// Level-Based Queries
// =============================================================================

/**
 * Get all regions at a specific level
 * 
 * @example
 * getAllByLevel("ITL1") // All 12 ITL1 regions
 * getAllByLevel("ITL2") // All 46 ITL2 regions
 */
export function getAllByLevel(level: RegionLevel): Array<{ code: string; name: string }> {
  const codes = hierarchy.byLevel[level] ?? []
  return codes
    .map(code => hierarchy.regions[code])
    .filter(Boolean)
    .map(r => ({ code: r.code, name: r.name }))
}

/**
 * Get all region codes at a specific level
 */
export function getAllCodesByLevel(level: RegionLevel): string[] {
  return hierarchy.byLevel[level] ?? []
}

/**
 * Get count of regions at each level
 */
export function getRegionCounts(): Record<RegionLevel, number> {
  return {
    ITL1: hierarchy.byLevel.ITL1.length,
    ITL2: hierarchy.byLevel.ITL2.length,
    ITL3: hierarchy.byLevel.ITL3.length,
    LAD: hierarchy.byLevel.LAD.length,
  }
}

// =============================================================================
// Search & Discovery
// =============================================================================

/**
 * Find regions by name (case-insensitive partial match)
 * 
 * @example
 * findRegionsByName("manchester") // Greater Manchester, Manchester, etc.
 * findRegionsByName("london") // London, Inner London, Outer London, etc.
 */
export function findRegionsByName(query: string): Array<{ code: string; name: string; level: RegionLevel }> {
  const lowerQuery = query.toLowerCase()

  return Object.values(hierarchy.regions)
    .filter(r => r.name.toLowerCase().includes(lowerQuery))
    .map(r => ({ code: r.code, name: r.name, level: r.level }))
    .sort((a, b) => {
      // Prefer exact matches, then shorter names, then alphabetical
      const aExact = a.name.toLowerCase() === lowerQuery
      const bExact = b.name.toLowerCase() === lowerQuery
      if (aExact !== bExact) return aExact ? -1 : 1
      if (a.name.length !== b.name.length) return a.name.length - b.name.length
      return a.name.localeCompare(b.name)
    })
}

/**
 * Find all ITL2 regions in a given ITL1
 * 
 * @example
 * getITL2sInITL1("UKD") // [{ code: "TLD1", name: "Cumbria" }, { code: "TLD3", name: "Greater Manchester" }, ...]
 */
export function getITL2sInITL1(itl1Code: string): Array<{ code: string; name: string }> {
  const children = hierarchy.parentToChildren.ITL1ToITL2[itl1Code] ?? []
  return children
    .map(code => hierarchy.regions[code])
    .filter(Boolean)
    .map(r => ({ code: r.code, name: r.name }))
}

/**
 * Find all ITL3 regions in a given ITL2
 * 
 * @example
 * getITL3sInITL2("TLD3") // [{ code: "TLD33", name: "Manchester" }, ...]
 */
export function getITL3sInITL2(itl2Code: string): Array<{ code: string; name: string }> {
  const children = hierarchy.parentToChildren.ITL2ToITL3[itl2Code] ?? []
  return children
    .map(code => hierarchy.regions[code])
    .filter(Boolean)
    .map(r => ({ code: r.code, name: r.name }))
}

// =============================================================================
// Comparison Helpers
// =============================================================================

/**
 * Get comparison regions for a given region
 * Returns parent, siblings, and optionally national peers
 * 
 * @example
 * getComparisonRegions("TLD3")
 * // {
 * //   parent: { code: "UKD", name: "North West (England)" },
 * //   siblings: [{ code: "TLD1", name: "Cumbria" }, ...],
 * //   national: [{ code: "TLG3", name: "West Midlands" }, ...] // other major metros
 * // }
 */
export function getComparisonRegions(code: string): {
  self: { code: string; name: string; level: RegionLevel } | null
  parent: { code: string; name: string; level: RegionLevel } | null
  siblings: Array<{ code: string; name: string }>
  itl1: { code: string; name: string } | null
} {
  const region = hierarchy.regions[code]

  return {
    self: region ? { code: region.code, name: region.name, level: region.level } : null,
    parent: getParent(code),
    siblings: getSiblings(code),
    itl1: getITL1Ancestor(code),
  }
}

/**
 * Get a set of recommended comparison regions for benchmarking
 * Includes parent, a sample of siblings, and UK average context
 */
export function getRecommendedComparisons(code: string, maxSiblings = 5): string[] {
  const comparisons: string[] = []
  const region = hierarchy.regions[code]
  if (!region) return []

  // Add parent
  if (region.parentCode) {
    comparisons.push(region.parentCode)
  }

  // Add up to maxSiblings siblings
  const siblings = region.siblings?.slice(0, maxSiblings) ?? []
  comparisons.push(...siblings)

  return comparisons
}

// =============================================================================
// Metadata
// =============================================================================

/**
 * Get hierarchy metadata
 */
export function getHierarchyMeta(): {
  generatedAt: string
  sourceFile: string
  totalRegions: number
} {
  return hierarchy.meta
}
