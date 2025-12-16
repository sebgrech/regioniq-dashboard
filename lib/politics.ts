// Westminster election data helpers

export type PartyVotes = Record<string, number>

export interface ConstituencyResult {
  code: string
  name: string
  country: string
  totalVotes: number
  electorate: number
  turnoutPct: number
  winnerPartyId: string
  winnerPartyName: string
  winnerShort: string
  mpName: string
  majority: number
  majorityPct: number
  partyVotes: PartyVotes
}

interface WestminsterSummary {
  seatsByParty: Record<string, number>
  avgTurnout: number
  seatCount: number
}

let constituencyCache: Record<string, ConstituencyResult> | null = null
let ladMapCache: Record<string, string[]> | null = null

async function loadConstituencies(): Promise<Record<string, ConstituencyResult>> {
  if (!constituencyCache) {
    const res = await fetch("/politics/constituency_results_2024.json")
    if (!res.ok) {
      throw new Error(`Failed to load constituency data: ${res.statusText}`)
    }
    constituencyCache = await res.json()
  }
  return constituencyCache!
}

async function loadLadMap(): Promise<Record<string, string[]>> {
  if (!ladMapCache) {
    const res = await fetch("/politics/lad_to_constituencies_2024.json")
    if (!res.ok) {
      throw new Error(`Failed to load LAD mapping: ${res.statusText}`)
    }
    ladMapCache = await res.json()
  }
  return ladMapCache!
}

/**
 * Get Westminster constituencies for a specific LAD
 * @param ladCode - LAD code (e.g., "E08000014")
 * @returns Array of constituency results
 */
export async function getWestminsterForLad(ladCode: string): Promise<ConstituencyResult[]> {
  const [constituencies, ladMap] = await Promise.all([
    loadConstituencies(),
    loadLadMap(),
  ])

  // Try direct lookup first (most LAD codes are the same between 2024 and 2025)
  let pconCodes = ladMap[ladCode] ?? []
  
  // If not found, log for debugging
  if (pconCodes.length === 0) {
    console.warn(`[Westminster] No constituencies found for LAD code: ${ladCode}`)
    console.log(`[Westminster] Available LAD codes in mapping (sample):`, Object.keys(ladMap).slice(0, 10))
    
    // Check if there's a similar code (in case of LAD24CD vs LAD25CD mismatch)
    // For now, just return empty - we'll need to handle mapping separately if needed
  }

  const results = pconCodes
    .map((code) => constituencies[code])
    .filter(Boolean) as ConstituencyResult[]

  if (results.length > 0) {
    console.log(`[Westminster] Found ${results.length} constituencies for LAD ${ladCode}`)
  }

  return results
}

/**
 * Summarize Westminster results for an LAD
 * @param results - Array of constituency results
 * @returns Summary with seat counts by party and average turnout
 */
export function summariseLadWestminster(results: ConstituencyResult[]): WestminsterSummary | null {
  if (results.length === 0) return null

  const seatsByParty: Record<string, number> = {}
  let combinedTurnout = 0

  results.forEach((c) => {
    const key = c.winnerShort || c.winnerPartyName
    seatsByParty[key] = (seatsByParty[key] || 0) + 1
    combinedTurnout += c.turnoutPct
  })

  const avgTurnout = combinedTurnout / results.length

  return { seatsByParty, avgTurnout, seatCount: results.length }
}

/**
 * Get party color for display
 * @param party - Party name (short form)
 * @returns Hex color code
 */
export function partyColor(party: string): string {
  const colors: Record<string, string> = {
    Labour: "#d50000",
    Conservative: "#0047ab",
    "Liberal Democrats": "#ffcc00",
    "Lib Dem": "#ffcc00",
    Green: "#009e3b",
    "Reform UK": "#00bcd4",
    SNP: "#ffff00",
    "Plaid Cymru": "#008142",
    DUP: "#d46a4c",
    "Sinn Féin": "#326760",
    Alliance: "#f6cb2f",
    SDLP: "#2aa82c",
    UUP: "#6ab3e3",
    Independent: "#888888",
    Other: "#aaaaaa",
  }

  return colors[party] || "#888888"
}

/**
 * Format seat sentence for display
 * @param seatsByParty - Record of party -> seat count
 * @returns Formatted string like "3 Labour, 1 Conservative"
 */
export function formatSeatSentence(seatsByParty: Record<string, number>): string {
  const entries = Object.entries(seatsByParty)
    .sort(([, a], [, b]) => b - a)
    .map(([party, count]) => `${count} ${party}`)
  
  if (entries.length === 0) return "No seats"
  if (entries.length === 1) return entries[0]
  if (entries.length === 2) return `${entries[0]}, ${entries[1]}`
  
  const last = entries.pop()
  return `${entries.join(", ")}, and ${last}`
}

