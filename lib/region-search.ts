/**
 * Advanced Region Search with Grouped Results
 * 
 * Provides intelligent region search with:
 * - Weighted scoring by level
 * - Grouped results (Top Match, Cities, LADs, ITL3/2/1)
 * - Duplicate name collapsing
 * - City region intelligence
 */

import { REGIONS, type Region } from "./metrics.config"
import { CITY_REGIONS } from "./city-regions"

export type RegionLevel = "LAD" | "ITL1" | "ITL2" | "ITL3" | "CITY"

/**
 * Canonical city-to-ITL region mappings
 * For major cities, the ITL region is the canonical representation
 */
const CANONICAL_CITY_ITL: Record<string, { code: string; level: "ITL1" | "ITL2" }> = {
  "London": { code: "UKI", level: "ITL1" },
  "Manchester": { code: "TLD3", level: "ITL2" }, // Greater Manchester
  "Birmingham": { code: "TLG3", level: "ITL2" }, // West Midlands
  "Leeds": { code: "TLE4", level: "ITL2" }, // West Yorkshire
  "Liverpool": { code: "TLD7", level: "ITL2" }, // Merseyside
  "Sheffield": { code: "TLE3", level: "ITL2" }, // South Yorkshire
  "Bristol": { code: "TLK5", level: "ITL2" }, // West of England
  "Newcastle": { code: "TLC4", level: "ITL2" }, // Northumberland, Durham and Tyne & Wear
  "Nottingham": { code: "TLF1", level: "ITL2" }, // Derbyshire and Nottinghamshire
  "Leicester": { code: "TLF2", level: "ITL2" }, // Leicestershire, Rutland and Northamptonshire
  "Coventry": { code: "TLG3", level: "ITL2" }, // West Midlands
  "Southampton": { code: "TLJ3", level: "ITL2" }, // Hampshire and Isle of Wight
  "Portsmouth": { code: "TLJ3", level: "ITL2" }, // Hampshire and Isle of Wight
  "Glasgow": { code: "TLM3", level: "ITL2" }, // West Central Scotland
  "Edinburgh": { code: "TLM0", level: "ITL2" }, // Eastern Scotland
  "Cardiff": { code: "TLL5", level: "ITL2" }, // South East Wales
  "Aberdeen": { code: "TLM5", level: "ITL2" }, // North Eastern Scotland
  "Dundee": { code: "TLM0", level: "ITL2" }, // Eastern Scotland
  "Swansea": { code: "TLL5", level: "ITL2" }, // South East Wales
  "Belfast": { code: "TLN0", level: "ITL2" }, // Northern Ireland
}

export interface SearchableRegion {
  name: string
  code: string
  level: RegionLevel
  country: string
  synonyms: string[]
  cityRegionName?: string // If part of a city region, the city name
  constituentLads?: string[] // For city regions
}

export interface ScoredRegion extends SearchableRegion {
  score: number
  matchType: "exact" | "prefix" | "substring" | "none"
}

export interface GroupedResults {
  topMatch?: ScoredRegion[]
  cities: ScoredRegion[]
  lads: ScoredRegion[]
  itl3: ScoredRegion[]
  itl2: ScoredRegion[]
  itl1: ScoredRegion[]
}

// Base weights for scoring
const BASE_WEIGHTS: Record<RegionLevel, number> = {
  LAD: 100,
  CITY: 90,
  ITL3: 70,
  ITL2: 50,
  ITL1: 30,
}

// Scoring modifiers
const PREFIX_MATCH_BONUS = 30
const SUBSTRING_MATCH_BONUS = 10
const POPULATION_RELEVANCE_MAX = 15
const RECENT_SEARCH_BONUS = 20

/**
 * Create unified region index with all searchable regions
 */
export function createRegionIndex(): SearchableRegion[] {
  const index: SearchableRegion[] = []
  
  // Add all regions from REGIONS config
  for (const region of REGIONS) {
    const level = region.level === "LAD" ? "LAD" :
                  region.level === "ITL1" ? "ITL1" :
                  region.level === "ITL2" ? "ITL2" :
                  region.level === "ITL3" ? "ITL3" : "LAD"
    
    const synonyms: string[] = []
    
    // Add common name variations
    const nameLower = region.name.toLowerCase()
    if (nameLower.includes("county")) {
      synonyms.push(region.name.replace(/county/gi, "").trim())
    }
    if (nameLower.includes("city")) {
      synonyms.push(region.name.replace(/city/gi, "").trim())
    }
    if (nameLower.includes("borough")) {
      synonyms.push(region.name.replace(/borough/gi, "").trim())
    }
    
    index.push({
      name: region.name,
      code: region.code,
      level,
      country: region.country,
      synonyms,
    })
  }
  
  // Add canonical ITL regions for major cities
  // For cities with canonical ITL mappings, update the existing ITL region entry to use the city name
  // Sort cities by priority (larger/more prominent cities first) to handle multiple cities mapping to same ITL
  const cityPriority: Record<string, number> = {
    "London": 100,
    "Manchester": 90,
    "Birmingham": 85,
    "Leeds": 80,
    "Liverpool": 75,
    "Sheffield": 70,
    "Bristol": 65,
    "Glasgow": 60,
    "Edinburgh": 55,
    "Cardiff": 50,
    // Others default to 40
  }
  
  const sortedCities = Object.entries(CANONICAL_CITY_ITL).sort(([a], [b]) => {
    const priorityA = cityPriority[a] || 40
    const priorityB = cityPriority[b] || 40
    return priorityB - priorityA // Higher priority first
  })
  
  for (const [cityName, itlMapping] of sortedCities) {
    const itlRegion = REGIONS.find(
      (r) => r.code === itlMapping.code && r.level === itlMapping.level
    )
    
    if (itlRegion) {
      // Find the city's LADs from CITY_REGIONS
      const cityLads = CITY_REGIONS[cityName] || []
      
      // Find the existing ITL region entry in the index and update it
      const existingIndex = index.find((r) => r.code === itlRegion.code && r.level === itlMapping.level)
      if (existingIndex) {
        // Check if the current name is already a city name from CANONICAL_CITY_ITL
        const currentCityName = Object.keys(CANONICAL_CITY_ITL).find(
          (cn) => cn === existingIndex.name
        )
        const currentPriority = currentCityName ? (cityPriority[currentCityName] || 40) : 0
        const newPriority = cityPriority[cityName] || 40
        
        // Update if this city has higher priority, or if current name is not a city name
        if (!currentCityName || newPriority > currentPriority) {
          // Update the name to use the city name (e.g., "Manchester" not "Greater Manchester")
          existingIndex.name = cityName
          existingIndex.cityRegionName = cityName
          // Merge constituent LADs (some ITL regions have multiple cities)
          if (existingIndex.constituentLads) {
            existingIndex.constituentLads = [...new Set([...existingIndex.constituentLads, ...cityLads])]
          } else {
            existingIndex.constituentLads = cityLads
          }
          // Add city synonyms
          existingIndex.synonyms.push(...getCitySynonyms(cityName))
        } else {
          // Add this city as a synonym instead (lower priority city)
          existingIndex.synonyms.push(cityName, ...getCitySynonyms(cityName))
        }
      } else {
        // If not found (shouldn't happen), add it
        index.push({
          name: cityName,
          code: itlRegion.code,
          level: itlMapping.level,
          country: itlRegion.country,
          synonyms: getCitySynonyms(cityName),
          cityRegionName: cityName,
          constituentLads: cityLads,
        })
      }
      
      // Also mark constituent LADs as part of this city
      for (const ladCode of cityLads) {
        const ladIndex = index.find((r) => r.code === ladCode)
        if (ladIndex) {
          ladIndex.cityRegionName = cityName
        }
      }
    }
  }
  
  // Add city regions as searchable entries (only for cities without canonical ITL mappings)
  for (const [cityName, lads] of Object.entries(CITY_REGIONS)) {
    // Skip if this city has a canonical ITL region (those are handled above)
    if (CANONICAL_CITY_ITL[cityName]) {
      continue
    }
    
    // For non-canonical cities, create a city region entry
    index.push({
      name: cityName,
      code: `CITY:${cityName}`, // Use CITY: prefix to distinguish from LAD codes
      level: "CITY",
      country: lads.length > 0 ? getCountryFromLad(lads[0]) : "England",
      synonyms: getCitySynonyms(cityName),
      cityRegionName: cityName,
      constituentLads: lads,
    })
    
    // Mark constituent LADs as part of this city
    for (const ladCode of lads) {
      const ladIndex = index.find((r) => r.code === ladCode)
      if (ladIndex) {
        ladIndex.cityRegionName = cityName
      }
    }
  }
  
  return index
}

/**
 * Get country from LAD code
 */
function getCountryFromLad(ladCode: string): string {
  if (ladCode.startsWith("E")) return "England"
  if (ladCode.startsWith("S")) return "Scotland"
  if (ladCode.startsWith("W")) return "Wales"
  if (ladCode.startsWith("N")) return "Northern Ireland"
  return "England"
}

/**
 * Get synonyms for city names
 */
function getCitySynonyms(cityName: string): string[] {
  const synonyms: string[] = []
  const lower = cityName.toLowerCase()
  
  // Add common variations
  if (lower === "manchester") {
    synonyms.push("Greater Manchester")
  }
  if (lower.includes("london")) {
    synonyms.push("Greater London", "GLA")
  }
  
  return synonyms
}

/**
 * Score a region against a search query
 */
export function scoreRegion(
  query: string,
  region: SearchableRegion,
  recentSearches: string[] = []
): ScoredRegion {
  const queryLower = query.toLowerCase().trim()
  if (!queryLower) {
    return { ...region, score: 0, matchType: "none" }
  }
  
  // Check if this is a canonical city search
  const canonicalCity = Object.entries(CANONICAL_CITY_ITL).find(
    ([cityName]) => cityName.toLowerCase() === queryLower
  )
  
  // If searching for a canonical city, heavily boost its ITL region
  if (canonicalCity) {
    const [cityName, itlMapping] = canonicalCity
    if (region.code === itlMapping.code && region.level === itlMapping.level) {
      // This is the canonical ITL region for this city - give it massive boost
      return {
        ...region,
        score: 1000, // Very high score to ensure it's top match
        matchType: "exact",
      }
    }
    // For canonical cities, suppress city regions and individual LADs
    if (region.code.startsWith("CITY:") && region.name === cityName) {
      return { ...region, score: 0, matchType: "none" }
    }
    // Suppress individual LADs that are part of the canonical city
    if (region.level === "LAD" && region.cityRegionName === cityName) {
      // Still allow LADs but with lower score
      // (they'll be filtered out by the top match logic anyway)
    }
  }
  
  let score = BASE_WEIGHTS[region.level]
  let matchType: "exact" | "prefix" | "substring" | "none" = "none"
  
  // Check name match
  const nameLower = region.name.toLowerCase()
  if (nameLower === queryLower) {
    score += PREFIX_MATCH_BONUS + SUBSTRING_MATCH_BONUS
    matchType = "exact"
  } else if (nameLower.startsWith(queryLower)) {
    score += PREFIX_MATCH_BONUS
    matchType = "prefix"
  } else if (nameLower.includes(queryLower)) {
    score += SUBSTRING_MATCH_BONUS
    matchType = "substring"
  }
  
  // Check code match
  const codeLower = region.code.toLowerCase()
  if (codeLower === queryLower) {
    score += PREFIX_MATCH_BONUS + SUBSTRING_MATCH_BONUS
    if (matchType === "none") matchType = "exact"
  } else if (codeLower.startsWith(queryLower)) {
    score += PREFIX_MATCH_BONUS
    if (matchType === "none") matchType = "prefix"
  } else if (codeLower.includes(queryLower)) {
    score += SUBSTRING_MATCH_BONUS
    if (matchType === "none") matchType = "substring"
  }
  
  // Check synonyms
  for (const synonym of region.synonyms) {
    const synLower = synonym.toLowerCase()
    if (synLower === queryLower) {
      score += PREFIX_MATCH_BONUS
      if (matchType === "none") matchType = "exact"
    } else if (synLower.startsWith(queryLower)) {
      score += PREFIX_MATCH_BONUS * 0.5
      if (matchType === "none") matchType = "prefix"
    } else if (synLower.includes(queryLower)) {
      score += SUBSTRING_MATCH_BONUS * 0.5
      if (matchType === "none") matchType = "substring"
    }
  }
  
  // Population relevance (simplified - could be enhanced with actual population data)
  // For now, prioritize LADs and cities
  if (region.level === "LAD" || region.level === "CITY") {
    score += POPULATION_RELEVANCE_MAX * 0.5
  }
  
  // Recent search bonus
  if (recentSearches.includes(region.code)) {
    score += RECENT_SEARCH_BONUS
  }
  
  return {
    ...region,
    score,
    matchType,
  }
}

/**
 * Group scored results into buckets
 */
export function groupResults(scoredRegions: ScoredRegion[]): GroupedResults {
  // Sort by score descending
  const sorted = [...scoredRegions].sort((a, b) => b.score - a.score)
  
  // Identify top match (highest score, or top 1-2 if very close)
  const topScore = sorted[0]?.score || 0
  const topMatchThreshold = topScore * 0.9 // Within 90% of top score
  const topMatch = sorted.filter((r) => r.score >= topMatchThreshold && r.score > 0).slice(0, 2)
  
  // Group by level
  const groups: GroupedResults = {
    cities: [],
    lads: [],
    itl3: [],
    itl2: [],
    itl1: [],
  }
  
  if (topMatch.length > 0) {
    groups.topMatch = topMatch
  }
  
  for (const region of sorted) {
    // Skip if already in top match
    if (topMatch.some((tm) => tm.code === region.code)) {
      continue
    }
    
    switch (region.level) {
      case "CITY":
        groups.cities.push(region)
        break
      case "LAD":
        groups.lads.push(region)
        break
      case "ITL3":
        groups.itl3.push(region)
        break
      case "ITL2":
        groups.itl2.push(region)
        break
      case "ITL1":
        groups.itl1.push(region)
        break
    }
  }
  
  return groups
}

/**
 * Collapse duplicate region names
 */
export function collapseDuplicates(grouped: GroupedResults): GroupedResults {
  const collapsed: GroupedResults = {
    cities: [],
    lads: [],
    itl3: [],
    itl2: [],
    itl1: [],
  }
  
  if (grouped.topMatch) {
    collapsed.topMatch = grouped.topMatch
  }
  
  // Helper to collapse a group
  const collapseGroup = (regions: ScoredRegion[]): ScoredRegion[] => {
    const nameMap = new Map<string, ScoredRegion[]>()
    
    for (const region of regions) {
      const normalizedName = region.name
        .toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, "") // Remove parentheses
        .replace(/\s*&.*$/, "") // Remove "& Isles" etc
        .trim()
      
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, [])
      }
      nameMap.get(normalizedName)!.push(region)
    }
    
    const result: ScoredRegion[] = []
    for (const [name, duplicates] of nameMap.entries()) {
      if (duplicates.length === 1) {
        result.push(duplicates[0])
      } else {
        // Sort by score, take highest as primary
        duplicates.sort((a, b) => b.score - a.score)
        result.push(duplicates[0])
        // Store others as sub-items (could be expanded later)
      }
    }
    
    return result.sort((a, b) => b.score - a.score)
  }
  
  collapsed.cities = collapseGroup(grouped.cities)
  collapsed.lads = collapseGroup(grouped.lads)
  collapsed.itl3 = collapseGroup(grouped.itl3)
  collapsed.itl2 = collapseGroup(grouped.itl2)
  collapsed.itl1 = collapseGroup(grouped.itl1)
  
  return collapsed
}

/**
 * Search regions with intelligent grouping
 */
export function searchRegions(
  query: string,
  recentSearches: string[] = []
): GroupedResults {
  const index = createRegionIndex()
  const queryLower = query.toLowerCase().trim()
  
  // Score all regions
  const scored = index.map((region) => scoreRegion(query, region, recentSearches))
  
  // Filter out zero-score results and results that don't actually match
  // (base weight alone without any match bonus means no match)
  const baseWeights = Object.values(BASE_WEIGHTS)
  const minBaseWeight = Math.min(...baseWeights)
  const filtered = scored
    .filter((r) => {
      // Must have a match (not just base weight)
      if (r.matchType === "none") return false
      // Or must have a score significantly above base weight
      return r.score > minBaseWeight + 5
    })
    .sort((a, b) => b.score - a.score)
  
  // Group results
  const grouped = groupResults(filtered)
  
  // Collapse duplicates
  return collapseDuplicates(grouped)
}

