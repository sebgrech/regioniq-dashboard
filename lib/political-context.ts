// Political context aggregation system
// Aggregates Westminster seats and local control from constituent LADs

import { getWestminsterForLad, summariseLadWestminster, type ConstituencyResult } from "./politics"
import { getElectionSummary, getAvailableYears } from "./elections"
import { CITY_REGIONS, getCityLads } from "./city-regions"
import { getLadsForITL1, getLadsForITL2, getLadsForITL3 } from "./itl-to-lad"
import { REGIONS } from "./metrics.config"

export interface PoliticalContext {
  type: "lad" | "city" | "itl2" | "itl3" | "itl1"
  name: string
  regionCode: string
  ladCount: number
  westminsterSeats: ConstituencyResult[]
  leadingParty: string
  turnout: number // mean turnout
  majority: number // mean majority in points
  seatCounts: Record<string, number>
  localControlSummary: {
    LabourControlled: number
    ConservativeControlled: number
    NoOverallControl: number
    LiberalDemocratControlled: number
    GreenControlled: number
    ReformUKControlled: number
    OtherControlled: number
  }
}

/**
 * Get political context for a city region
 * Aggregates from all constituent LADs
 */
export async function getCityPoliticalContext(cityName: string): Promise<PoliticalContext | null> {
  const lads = getCityLads(cityName)
  if (lads.length === 0) {
    return null
  }

  return aggregatePoliticalContext(lads, "city", cityName, cityName)
}

/**
 * Get political context for an ITL region
 * Aggregates from all constituent LADs
 */
export async function getITLPoliticalContext(
  itlCode: string,
  level: "ITL1" | "ITL2" | "ITL3"
): Promise<PoliticalContext | null> {
  let lads: string[] = []
  
  switch (level) {
    case "ITL1":
      lads = getLadsForITL1(itlCode)
      break
    case "ITL2":
      lads = getLadsForITL2(itlCode)
      break
    case "ITL3":
      lads = getLadsForITL3(itlCode)
      break
  }

  if (lads.length === 0) {
    return null
  }

  const region = REGIONS.find((r) => r.code === itlCode)
  const regionName = region?.name || itlCode

  return aggregatePoliticalContext(lads, level.toLowerCase() as "itl1" | "itl2" | "itl3", itlCode, regionName)
}

/**
 * Get political context for a single LAD
 */
async function getLadPoliticalContext(ladCode: string): Promise<PoliticalContext | null> {
  const [westminsterSeats, localSummary] = await Promise.all([
    getWestminsterForLad(ladCode),
    getMostRecentElectionSummary(ladCode),
  ])

  if (westminsterSeats.length === 0 && !localSummary) {
    return null
  }

  const summary = summariseLadWestminster(westminsterSeats)
  const seatCounts = summary?.seatsByParty || {}
  const leadingParty = Object.entries(seatCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown"
  const turnout = summary?.avgTurnout || 0
  const majority =
    westminsterSeats.length > 0
      ? westminsterSeats.reduce((sum, s) => sum + s.majorityPct, 0) / westminsterSeats.length
      : 0

  const localControl = localSummary
    ? {
        LabourControlled: localSummary.dominant_party === "Labour" ? 1 : 0,
        ConservativeControlled: localSummary.dominant_party === "Conservative" ? 1 : 0,
        NoOverallControl: localSummary.dominant_party === "No overall control" ? 1 : 0,
        LiberalDemocratControlled: localSummary.dominant_party === "Liberal Democrats" ? 1 : 0,
        GreenControlled: localSummary.dominant_party === "Green" ? 1 : 0,
        ReformUKControlled: localSummary.dominant_party === "Reform UK" ? 1 : 0,
        OtherControlled: 0,
      }
    : {
        LabourControlled: 0,
        ConservativeControlled: 0,
        NoOverallControl: 0,
        LiberalDemocratControlled: 0,
        GreenControlled: 0,
        ReformUKControlled: 0,
        OtherControlled: 0,
      }

  const region = REGIONS.find((r) => r.code === ladCode)
  const regionName = region?.name || ladCode

  return {
    type: "lad",
    name: regionName,
    regionCode: ladCode,
    ladCount: 1,
    westminsterSeats,
    leadingParty,
    turnout,
    majority,
    seatCounts,
    localControlSummary: localControl,
  }
}

/**
 * Aggregate political context from multiple LADs
 */
async function aggregatePoliticalContext(
  lads: string[],
  type: "city" | "itl1" | "itl2" | "itl3",
  regionCode: string,
  regionName: string
): Promise<PoliticalContext | null> {
  if (lads.length === 0) {
    return null
  }

  // Fetch Westminster seats for all LADs in parallel
  const westminsterPromises = lads.map((lad) => getWestminsterForLad(lad))
  const westminsterResults = await Promise.all(westminsterPromises)

  // Deduplicate Westminster seats by constituency code
  const seatMap = new Map<string, ConstituencyResult>()
  for (const seats of westminsterResults) {
    for (const seat of seats) {
      if (!seatMap.has(seat.code)) {
        seatMap.set(seat.code, seat)
      }
    }
  }
  const uniqueSeats = Array.from(seatMap.values())

  // Aggregate seat counts by party
  const seatCounts: Record<string, number> = {}
  let combinedTurnout = 0
  let combinedMajority = 0

  for (const seat of uniqueSeats) {
    const party = seat.winnerShort || seat.winnerPartyName
    seatCounts[party] = (seatCounts[party] || 0) + 1
    combinedTurnout += seat.turnoutPct
    combinedMajority += seat.majorityPct
  }

  const turnout = uniqueSeats.length > 0 ? combinedTurnout / uniqueSeats.length : 0
  const majority = uniqueSeats.length > 0 ? combinedMajority / uniqueSeats.length : 0
  const leadingParty = Object.entries(seatCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown"

  // Aggregate local control from all LADs
  const localControlSummary = {
    LabourControlled: 0,
    ConservativeControlled: 0,
    NoOverallControl: 0,
    LiberalDemocratControlled: 0,
    GreenControlled: 0,
    ReformUKControlled: 0,
    OtherControlled: 0,
  }

  // Fetch local election summaries for all LADs
  const localPromises = lads.map((lad) => getMostRecentElectionSummary(lad))
  const localResults = await Promise.all(localPromises)

  for (const summary of localResults) {
    if (!summary) continue

    const party = summary.dominant_party
    if (party === "Labour") {
      localControlSummary.LabourControlled++
    } else if (party === "Conservative") {
      localControlSummary.ConservativeControlled++
    } else if (party === "No overall control") {
      localControlSummary.NoOverallControl++
    } else if (party === "Liberal Democrats") {
      localControlSummary.LiberalDemocratControlled++
    } else if (party === "Green") {
      localControlSummary.GreenControlled++
    } else if (party === "Reform UK") {
      localControlSummary.ReformUKControlled++
    } else {
      localControlSummary.OtherControlled++
    }
  }

  return {
    type,
    name: regionName,
    regionCode,
    ladCount: lads.length,
    westminsterSeats: uniqueSeats,
    leadingParty,
    turnout,
    majority,
    seatCounts,
    localControlSummary,
  }
}

/**
 * Get most recent election summary for a LAD
 */
function getMostRecentElectionSummary(ladCode: string) {
  const years = getAvailableYears(ladCode)
  if (years.length === 0) {
    return null
  }
  const mostRecentYear = Math.max(...years)
  return getElectionSummary(ladCode, mostRecentYear)
}

/**
 * Unified entry point for political context
 * Handles LAD, City, ITL2, ITL3, and ITL1 regions
 */
export async function getPoliticalContext(regionCode: string): Promise<PoliticalContext | null> {
  // Check if it's a city name
  const cityLads = getCityLads(regionCode)
  if (cityLads.length > 0) {
    return getCityPoliticalContext(regionCode)
  }

  // Check if it's a region code
  const region = REGIONS.find((r) => r.code === regionCode)
  if (!region) {
    return null
  }

  // Handle by region level
  switch (region.level) {
    case "LAD":
      return getLadPoliticalContext(regionCode)
    case "ITL1":
      return getITLPoliticalContext(regionCode, "ITL1")
    case "ITL2":
      return getITLPoliticalContext(regionCode, "ITL2")
    case "ITL3":
      return getITLPoliticalContext(regionCode, "ITL3")
    default:
      return null
  }
}

