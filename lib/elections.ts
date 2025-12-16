// Import processed election data
// Note: Next.js will handle this as a static import
// @ts-ignore - JSON import
import electionsData from "@/public/processed/lad_elections.json"

export interface ElectionSummary {
  dominant_party: string
  turnout: number
  marginality: number
  votes: Record<string, number>
  seats: Record<string, number>
}

type LadElectionsData = Record<string, Record<string, ElectionSummary>>

// Type assertion for the imported JSON
const elections = electionsData as LadElectionsData

/**
 * Get election summary for a specific LAD and year
 * @param ladCode - LAD code (e.g., "E08000014")
 * @param year - Election year (e.g., 2024)
 * @returns Election summary or null if not found
 */
export function getElectionSummary(
  ladCode: string,
  year: number
): ElectionSummary | null {
  const ladData = elections[ladCode]
  if (!ladData) {
    return null
  }
  
  const yearData = ladData[year.toString()]
  return yearData || null
}

/**
 * Get all available years for a specific LAD
 * @param ladCode - LAD code
 * @returns Array of available years
 */
export function getAvailableYears(ladCode: string): number[] {
  const ladData = elections[ladCode]
  if (!ladData) {
    return []
  }
  
  return Object.keys(ladData)
    .map((y) => parseInt(y, 10))
    .filter((y) => !isNaN(y))
    .sort()
}

/**
 * Get dominant party history for a LAD (last 3 years)
 * @param ladCode - LAD code
 * @returns Array of { year, party } objects
 */
export function getDominantPartyHistory(ladCode: string): Array<{ year: number; party: string }> {
  const years = getAvailableYears(ladCode)
  const history: Array<{ year: number; party: string }> = []
  
  for (const year of years) {
    const summary = getElectionSummary(ladCode, year)
    if (summary) {
      history.push({ year, party: summary.dominant_party })
    }
  }
  
  return history.sort((a, b) => a.year - b.year)
}


