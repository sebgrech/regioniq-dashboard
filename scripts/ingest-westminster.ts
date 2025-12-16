import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"

// Types
interface ElectionRow {
  person_id: string
  person_name: string
  election_id: string
  ballot_paper_id: string
  election_date: string
  election_current: string
  party_name: string
  party_id: string
  post_label: string
  cancelled_poll: string
  seats_contested: string
  by_election: string
  by_election_reason: string
  gss: string
  post_id: string
  candidates_locked: string
  nuts1: string
  organisation_name: string
  votes_cast: string
  elected: string
  total_electorate?: string
  turnout_percentage?: string
}

interface WardMapping {
  WD25CD: string
  PCON24CD: string
  LAD25CD: string
}

interface ConstituencyResult {
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
  partyVotes: Record<string, number>
}

// Party name normalization
const normalizePartyName = (partyName: string): string => {
  const normalized = partyName.trim()
  
  if (normalized.includes("Labour") || normalized.includes("Co-operative")) {
    return "Labour"
  }
  if (normalized.includes("Conservative") || normalized.includes("Unionist")) {
    return "Conservative"
  }
  if (normalized.includes("Liberal Democrat")) {
    return "Liberal Democrats"
  }
  if (normalized.includes("Green")) {
    return "Green"
  }
  if (normalized.includes("Reform")) {
    return "Reform UK"
  }
  if (normalized.includes("Scottish National Party") || normalized.includes("SNP")) {
    return "SNP"
  }
  if (normalized.includes("Plaid Cymru")) {
    return "Plaid Cymru"
  }
  if (normalized.includes("Democratic Unionist Party") || normalized.includes("DUP")) {
    return "DUP"
  }
  if (normalized.includes("Sinn Féin")) {
    return "Sinn Féin"
  }
  if (normalized.includes("Alliance Party")) {
    return "Alliance"
  }
  if (normalized.includes("Social Democratic and Labour Party") || normalized.includes("SDLP")) {
    return "SDLP"
  }
  if (normalized.includes("Ulster Unionist Party") || normalized.includes("UUP")) {
    return "UUP"
  }
  if (normalized.includes("Independent") || normalized === "IND") {
    return "Independent"
  }
  
  return normalized
}

// Get country from NUTS1 or organisation
const getCountry = (nuts1: string, organisationName: string): string => {
  if (nuts1?.includes("England") || organisationName?.includes("England")) {
    return "England"
  }
  if (nuts1?.includes("Scotland") || organisationName?.includes("Scotland")) {
    return "Scotland"
  }
  if (nuts1?.includes("Wales") || organisationName?.includes("Wales")) {
    return "Wales"
  }
  if (nuts1?.includes("Northern Ireland") || organisationName?.includes("Northern Ireland")) {
    return "Northern Ireland"
  }
  return "England" // Default
}

// Check if candidate was elected
const isElected = (elected: string): boolean => {
  return elected?.toLowerCase() === "t" || elected === "1" || elected?.toLowerCase() === "true"
}

// Parse CSV file
function parseCSV<T>(filePath: string): T[] {
  let content = readFileSync(filePath, "utf-8")
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
  return records
}

// Process constituency results
function processConstituencyResults(): Record<string, ConstituencyResult> {
  console.log("\n📊 Processing Westminster constituency results...")
  
  const csvPath = join(process.cwd(), "public/elections/general_election_2024.csv")
  const records = parseCSV<ElectionRow>(csvPath)
  console.log(`   Found ${records.length} candidate records`)
  
  // Group by constituency (gss or post_id)
  const constituencyMap = new Map<string, ElectionRow[]>()
  
  for (const record of records) {
    const constituencyCode = record.gss?.replace(/^gss:/i, "").trim() || record.post_id?.replace(/^gss:/i, "").trim() || ""
    if (!constituencyCode) continue
    
    if (!constituencyMap.has(constituencyCode)) {
      constituencyMap.set(constituencyCode, [])
    }
    constituencyMap.get(constituencyCode)!.push(record)
  }
  
  console.log(`   Found ${constituencyMap.size} constituencies`)
  
  const results: Record<string, ConstituencyResult> = {}
  
  for (const [code, candidates] of constituencyMap.entries()) {
    if (candidates.length === 0) continue
    
    // Get constituency name from first record
    const firstRecord = candidates[0]
    const name = firstRecord.post_label || ""
    
    // Get country
    const country = getCountry(firstRecord.nuts1 || "", firstRecord.organisation_name || "")
    
    // Aggregate votes
    const partyVotes: Record<string, number> = {}
    let totalVotes = 0
    let electorate = 0
    let turnoutPct = 0
    
    // Find elected candidate
    let winner: ElectionRow | null = null
    
    for (const candidate of candidates) {
      const votes = parseInt(candidate.votes_cast || "0", 10)
      if (isNaN(votes)) continue
      
      totalVotes += votes
      
      const partyName = normalizePartyName(candidate.party_name || "")
      partyVotes[partyName] = (partyVotes[partyName] || 0) + votes
      
      if (isElected(candidate.elected || "")) {
        winner = candidate
      }
      
      // Get electorate and turnout from first valid record
      if (electorate === 0 && candidate.total_electorate) {
        electorate = parseInt(candidate.total_electorate, 10)
      }
      if (turnoutPct === 0 && candidate.turnout_percentage) {
        turnoutPct = parseFloat(candidate.turnout_percentage)
      }
    }
    
    // Calculate turnout if not provided
    if (turnoutPct === 0 && electorate > 0) {
      turnoutPct = (totalVotes / electorate) * 100
    }
    
    if (!winner) {
      // If no elected flag, find candidate with most votes
      winner = candidates.reduce((max, c) => {
        const maxVotes = parseInt(max.votes_cast || "0", 10)
        const cVotes = parseInt(c.votes_cast || "0", 10)
        return cVotes > maxVotes ? c : max
      }, candidates[0])
    }
    
    // Calculate majority
    const winnerVotes = parseInt(winner.votes_cast || "0", 10)
    const sortedParties = Object.entries(partyVotes)
      .sort(([, a], [, b]) => b - a)
    
    const secondPlaceVotes = sortedParties.length > 1 ? sortedParties[1][1] : 0
    const majority = winnerVotes - secondPlaceVotes
    const majorityPct = totalVotes > 0 ? (majority / totalVotes) * 100 : 0
    
    const winnerShort = normalizePartyName(winner.party_name || "")
    
    results[code] = {
      code,
      name,
      country,
      totalVotes,
      electorate,
      turnoutPct,
      winnerPartyId: winner.party_id || "",
      winnerPartyName: winner.party_name || "",
      winnerShort,
      mpName: winner.person_name || "",
      majority,
      majorityPct,
      partyVotes,
    }
  }
  
  console.log(`   ✅ Processed ${Object.keys(results).length} constituencies`)
  return results
}

// Build LAD to constituencies mapping
function buildLadToConstituencies(): Record<string, string[]> {
  console.log("\n📊 Building LAD to constituencies mapping...")
  
  const csvPath = join(process.cwd(), "public/reference/Ward_to_LAD_to_consituency.csv")
  const records = parseCSV<Record<string, string>>(csvPath)
  console.log(`   Found ${records.length} ward mapping records`)
  
  const mapping: Record<string, Set<string>> = {}
  
  for (const record of records) {
    // Handle BOM in column name
    const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
    const pconCode = record.PCON24CD || ""
    
    if (ladCode && pconCode) {
      if (!mapping[ladCode]) {
        mapping[ladCode] = new Set()
      }
      mapping[ladCode].add(pconCode.trim())
    }
  }
  
  // Convert Sets to arrays
  const result: Record<string, string[]> = {}
  for (const [lad, pcons] of Object.entries(mapping)) {
    result[lad] = Array.from(pcons)
  }
  
  console.log(`   ✅ Mapped ${Object.keys(result).length} LADs to constituencies`)
  return result
}

// Main function
function main() {
  console.log("🚀 Starting Westminster election ingestion...\n")
  
  // Process constituency results
  const constituencyResults = processConstituencyResults()
  
  // Build LAD mapping
  const ladMapping = buildLadToConstituencies()
  
  // Ensure output directory exists
  const outputDir = join(process.cwd(), "public/politics")
  mkdirSync(outputDir, { recursive: true })
  
  // Write constituency results
  const constituencyPath = join(outputDir, "constituency_results_2024.json")
  writeFileSync(constituencyPath, JSON.stringify(constituencyResults, null, 2), "utf-8")
  console.log(`\n✅ Successfully generated ${constituencyPath}`)
  console.log(`   Total constituencies: ${Object.keys(constituencyResults).length}`)
  
  // Write LAD mapping
  const mappingPath = join(outputDir, "lad_to_constituencies_2024.json")
  writeFileSync(mappingPath, JSON.stringify(ladMapping, null, 2), "utf-8")
  console.log(`✅ Successfully generated ${mappingPath}`)
  console.log(`   Total LADs: ${Object.keys(ladMapping).length}`)
  
  // Print sample
  const sampleConstituency = Object.keys(constituencyResults)[0]
  if (sampleConstituency) {
    console.log(`\n📋 Sample constituency data for ${sampleConstituency}:`)
    console.log(JSON.stringify(constituencyResults[sampleConstituency], null, 2))
  }
  
  const sampleLad = Object.keys(ladMapping)[0]
  if (sampleLad) {
    console.log(`\n📋 Sample LAD mapping for ${sampleLad}:`)
    console.log(JSON.stringify(ladMapping[sampleLad], null, 2))
  }
}

// Run
main()

