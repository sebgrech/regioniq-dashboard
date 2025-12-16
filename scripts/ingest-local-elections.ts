import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { REGIONS } from "../lib/metrics.config"

// Types
interface ElectionRow {
  gss: string
  party_name: string
  votes_cast: string
  elected: string
  turnout_percentage: string
  organisation_name: string
  by_election?: string // 't' for by-election, 'f' for full election
  seats_contested?: string // Number of seats contested in this ballot
  ballot_paper_id?: string // Can contain '.by.' for by-elections
}

interface WardMapping {
  WD24CD: string
  LAD24CD: string
}

interface PartyData {
  votes: number
  seats: number
}

interface ElectionSummary {
  dominant_party: string
  turnout: number
  marginality: number
  votes: Record<string, number>
  seats: Record<string, number>
}

type LadElectionsData = Record<string, Record<string, ElectionSummary>>

// Party name normalization
const normalizePartyName = (partyName: string): string => {
  const normalized = partyName.trim()
  
  // Handle variations
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
  if (normalized.includes("Independent") || normalized === "IND") {
    return "Independent"
  }
  
  return normalized
}

// Normalize ward code (remove "gss:" prefix if present)
const normalizeWardCode = (code: string): string => {
  return code.replace(/^gss:/i, "").trim()
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

// Load ward to LAD mapping
function loadWardMapping(): Map<string, string> {
  const mapping = new Map<string, string>()
  const records = parseCSV<Record<string, string>>(join(process.cwd(), "public/reference/Ward_to_LAD.csv"))
  
  for (const record of records) {
    // Handle BOM in column name - try both with and without BOM
    const wardCode = record.WD24CD || record["﻿WD24CD"] || ""
    const ladCode = record.LAD24CD || ""
    
    if (wardCode && ladCode) {
      const normalizedWard = normalizeWardCode(wardCode)
      mapping.set(normalizedWard, ladCode.trim())
      // Also map raw code
      mapping.set(wardCode.trim(), ladCode.trim())
    }
  }
  
  console.log(`✅ Loaded ${mapping.size} ward-to-LAD mappings`)
  if (records.length > 0) {
    const first = records[0]
    const wd = first.WD24CD || first["﻿WD24CD"] || ""
    const lad = first.LAD24CD || ""
    if (wd && lad) {
      console.log(`   Sample: ${wd} → ${lad}`)
    }
  }
  return mapping
}

// Load LAD name to code mapping
function loadLadNameMapping(): Map<string, string> {
  const mapping = new Map<string, string>()
  
  for (const region of REGIONS) {
    if (region.level === "LAD") {
      // Normalize name for matching (lowercase, remove common suffixes)
      const normalizedName = region.name
        .toLowerCase()
        .replace(/, city of$/, "")
        .replace(/, city$/, "")
        .replace(/ borough$/, "")
        .replace(/ district$/, "")
        .replace(/ council$/, "")
        .replace(/^county of /, "") // Remove "County of" prefix
        .trim()
      mapping.set(normalizedName, region.code)
      // Also map exact name
      mapping.set(region.name.toLowerCase(), region.code)
      // Map with "Council" suffix
      mapping.set(`${normalizedName} council`, region.code)
      mapping.set(`${region.name.toLowerCase()} council`, region.code)
      // Map with "County Council" suffix
      if (region.name.toLowerCase().includes("county")) {
        mapping.set(`${normalizedName} county council`, region.code)
      }
    }
  }
  
  return mapping
}

// Process election year
function processElectionYear(
  year: number,
  csvPath: string,
  wardMapping: Map<string, string>
): Record<string, ElectionSummary> {
  console.log(`\n📊 Processing ${year} elections...`)
  
  const records = parseCSV<ElectionRow>(csvPath)
  console.log(`   Found ${records.length} election records`)
  
  // Load LAD name mapping for fallback (when gss is missing)
  const ladNameMapping = loadLadNameMapping()
  
  // Aggregate by LAD
  const ladData = new Map<string, Map<string, PartyData>>()
  const ladTurnouts = new Map<string, number[]>() // Track turnouts per LAD
  
  for (const record of records) {
    // FILTER OUT BY-ELECTIONS
    // By-elections are single-ward elections that don't represent borough-wide control
    // They can be identified by:
    // 1. by_election == 't'
    // 2. ballot_paper_id contains '.by.'
    // Note: seats_contested == '1' alone is NOT sufficient - some wards legitimately have 1 seat
    const isByElection = 
      record.by_election === 't' ||
      (record.ballot_paper_id && record.ballot_paper_id.includes('.by.'))
    
    if (isByElection) {
      // Skip by-elections - they don't represent full local authority elections
      continue
    }
    
    // Get ward code and normalize
    const rawGss = record.gss || ""
    let ladCode: string | undefined
    
    if (rawGss) {
      // Try to get LAD from ward code mapping
      const wardCode = normalizeWardCode(rawGss)
      ladCode = wardMapping.get(wardCode) || wardMapping.get(rawGss.trim())
    }
    
    // Fallback: try to get LAD from organisation_name if gss is missing
    if (!ladCode && record.organisation_name) {
      let orgName = record.organisation_name
        .toLowerCase()
        .replace(/, city of$/, "")
        .replace(/, city$/, "")
        .replace(/ borough$/, "")
        .replace(/ district$/, "")
        .replace(/ council$/, "")
        .replace(/^county of /, "") // Remove "County of" prefix
        .trim()
      
      // Handle "X County Council" -> "X" (e.g., "Durham County Council" -> "durham county" -> "durham")
      // Check for " county " (with spaces) or " county" (at end) or "county " (at start)
      if (orgName.includes(" county ")) {
        const parts = orgName.split(" county ")
        if (parts.length === 2) {
          orgName = parts[0].trim()
        }
      } else if (orgName.endsWith(" county")) {
        orgName = orgName.replace(/ county$/, "").trim()
      } else if (orgName.startsWith("county ")) {
        orgName = orgName.replace(/^county /, "").trim()
      }
      
      // Try multiple matching strategies
      ladCode = 
        ladNameMapping.get(orgName) ||
        ladNameMapping.get(record.organisation_name.toLowerCase()) ||
        ladNameMapping.get(`${orgName} council`) ||
        ladNameMapping.get(`${orgName} county council`)
      
      // Special case: handle word order differences (e.g., "County Durham" vs "Durham County")
      // Also handle single-word org names that might match multi-word LAD names
      if (!ladCode) {
        // Try reversing word order if orgName has multiple words
        if (orgName.includes(" ")) {
          const words = orgName.split(" ").filter(w => w !== "county")
          const reversed = words.reverse().join(" ")
          ladCode = ladNameMapping.get(reversed)
        }
        
        // Try matching single-word org name to LAD names by removing "county" from LAD name
        // e.g., "durham" (from "Durham County Council") should match "County Durham"
        if (!ladCode && !orgName.includes(" ")) {
          for (const [mappedName, mappedCode] of ladNameMapping.entries()) {
            const normalizedMapped = mappedName
              .replace(/^county /, "")
              .replace(/ county$/, "")
              .replace(/ county /, " ")
              .trim()
            if (normalizedMapped === orgName) {
              ladCode = mappedCode
              break
            }
          }
        }
      }
    }
    
    if (!ladCode) {
      // Skip if no mapping found
      continue
    }
    
    // Track turnout for this ward/LAD
    const turnoutPct = parseFloat(record.turnout_percentage || "0")
    if (!isNaN(turnoutPct) && turnoutPct > 0) {
      if (!ladTurnouts.has(ladCode)) {
        ladTurnouts.set(ladCode, [])
      }
      ladTurnouts.get(ladCode)!.push(turnoutPct / 100) // Convert to decimal
    }
    
    // Get party name and normalize
    const partyName = normalizePartyName(record.party_name || "")
    if (!partyName) continue
    
    // Get votes
    const votes = parseInt(record.votes_cast || "0", 10)
    if (isNaN(votes)) continue
    
    // Check if elected
    const elected = isElected(record.elected || "")
    
    // Initialize LAD if needed
    if (!ladData.has(ladCode)) {
      ladData.set(ladCode, new Map<string, PartyData>())
    }
    
    const partyMap = ladData.get(ladCode)!
    
    // Initialize party if needed
    if (!partyMap.has(partyName)) {
      partyMap.set(partyName, { votes: 0, seats: 0 })
    }
    
    const partyData = partyMap.get(partyName)!
    partyData.votes += votes
    if (elected) {
      partyData.seats += 1
    }
  }
  
  // Convert to final format
  const result: Record<string, ElectionSummary> = {}
  
  for (const [ladCode, partyMap] of ladData.entries()) {
    // Convert to arrays for sorting
    const parties = Array.from(partyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.votes - a.votes)
    
    if (parties.length === 0) continue
    
    // Calculate totals
    const totalVotes = parties.reduce((sum, p) => sum + p.votes, 0)
    const totalSeats = parties.reduce((sum, p) => sum + p.seats, 0)
    
    // Determine dominant party (most seats, tie-break with votes)
    const dominantParty = parties.reduce((max, p) => {
      if (p.seats > max.seats) return p
      if (p.seats === max.seats && p.votes > max.votes) return p
      return max
    }, parties[0])
    
    // Calculate marginality (vote share difference between 1st and 2nd)
    let marginality = 1.0 // Default to 100% if only one party
    if (parties.length > 1 && totalVotes > 0) {
      const firstShare = parties[0].votes / totalVotes
      const secondShare = parties[1].votes / totalVotes
      marginality = firstShare - secondShare
    }
    
    // Calculate average turnout for this LAD
    const turnoutValues = ladTurnouts.get(ladCode) || []
    // Dedupe by taking unique values (same ward may appear multiple times)
    const uniqueTurnouts = Array.from(new Set(turnoutValues))
    const turnout = uniqueTurnouts.length > 0
      ? uniqueTurnouts.reduce((sum, t) => sum + t, 0) / uniqueTurnouts.length
      : 0.40 // Fallback to 40% if no turnout data
    
    // Build votes and seats objects
    const votes: Record<string, number> = {}
    const seats: Record<string, number> = {}
    
    for (const party of parties) {
      votes[party.name] = party.votes
      seats[party.name] = party.seats
    }
    
    result[ladCode] = {
      dominant_party: dominantParty.name,
      turnout,
      marginality,
      votes,
      seats,
    }
  }
  
  console.log(`   ✅ Processed ${Object.keys(result).length} LADs`)
  return result
}

// Main function
function main() {
  console.log("🚀 Starting local elections ingestion...\n")
  
  // Load ward mapping
  const wardMapping = loadWardMapping()
  
  // Process each year
  const allData: LadElectionsData = {}
  
  const years = [2022, 2023, 2024, 2025]
  for (const year of years) {
    // Use filtered normalized version for 2022 if it exists, otherwise regular
    const csvPath = year === 2022 && 
      require("fs").existsSync(join(process.cwd(), "public/elections/local_elections_2022_filtered_normalized.csv"))
      ? join(process.cwd(), "public/elections/local_elections_2022_filtered_normalized.csv")
      : join(process.cwd(), `public/elections/local_elections_${year}.csv`)
    
    try {
      const yearData = processElectionYear(year, csvPath, wardMapping)
      
      // Merge into allData
      for (const [ladCode, summary] of Object.entries(yearData)) {
        if (!allData[ladCode]) {
          allData[ladCode] = {}
        }
        allData[ladCode][year.toString()] = summary
      }
    } catch (error) {
      console.warn(`⚠️  Could not process ${year}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  // Ensure output directory exists
  const outputDir = join(process.cwd(), "public/processed")
  mkdirSync(outputDir, { recursive: true })
  
  // Write output
  const outputPath = join(outputDir, "lad_elections.json")
  writeFileSync(outputPath, JSON.stringify(allData, null, 2), "utf-8")
  
  console.log(`\n✅ Successfully generated ${outputPath}`)
  console.log(`   Total LADs: ${Object.keys(allData).length}`)
  
  // Print sample
  const sampleLad = Object.keys(allData)[0]
  if (sampleLad) {
    console.log(`\n📋 Sample data for ${sampleLad}:`)
    console.log(JSON.stringify(allData[sampleLad], null, 2))
  }
}

// Run
main()

