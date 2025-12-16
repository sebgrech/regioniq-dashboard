import { parse } from "csv-parse/sync"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { REGIONS } from "../lib/metrics.config"

interface ElectionRow {
  gss?: string
  organisation_name?: string
  by_election?: string
  seats_contested?: string
  ballot_paper_id?: string
  votes_cast?: string
  elected?: string
  turnout_percentage?: string
}

interface DiagnosticResult {
  ladCode: string
  ladName: string
  issues: string[]
  hasSourceData: boolean
  hasWardMapping: boolean
  hasOrgNameMatch: boolean
  sampleRecords: number
  byElectionCount: number
  missingGssCount: number
}

// Load ward mapping
function loadWardMapping(): Map<string, string> {
  const mapping = new Map<string, string>()
  const csvPath = join(process.cwd(), "public/reference/Ward_to_LAD.csv")
  
  if (!existsSync(csvPath)) {
    console.error(`❌ Ward mapping file not found: ${csvPath}`)
    return mapping
  }
  
  let content = readFileSync(csvPath, "utf-8")
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]
  
  for (const record of records) {
    const wardCode = record.WD24CD || record["﻿WD24CD"] || ""
    const ladCode = record.LAD24CD || ""
    
    if (wardCode && ladCode) {
      mapping.set(wardCode.trim(), ladCode.trim())
    }
  }
  
  return mapping
}

// Load LAD name mapping
function loadLadNameMapping(): Map<string, string> {
  const mapping = new Map<string, string>()
  
  for (const region of REGIONS) {
    if (region.level === "LAD") {
      const normalizedName = region.name
        .toLowerCase()
        .replace(/, city of$/, "")
        .replace(/, city$/, "")
        .replace(/ borough$/, "")
        .replace(/ district$/, "")
        .replace(/ council$/, "")
        .trim()
      mapping.set(normalizedName, region.code)
      mapping.set(region.name.toLowerCase(), region.code)
    }
  }
  
  return mapping
}

// Parse CSV
function parseCSV<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return []
  }
  
  let content = readFileSync(filePath, "utf-8")
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
}

// Check a specific LAD
function diagnoseLad(
  ladCode: string,
  ladName: string,
  wardMapping: Map<string, string>,
  ladNameMapping: Map<string, string>,
  allElectionRecords: ElectionRow[]
): DiagnosticResult {
  const result: DiagnosticResult = {
    ladCode,
    ladName,
    issues: [],
    hasSourceData: false,
    hasWardMapping: false,
    hasOrgNameMatch: false,
    sampleRecords: 0,
    byElectionCount: 0,
    missingGssCount: 0,
  }
  
  // Find records that might belong to this LAD
  const potentialRecords: ElectionRow[] = []
  
  for (const record of allElectionRecords) {
    // Check if it's a by-election
    const isByElection = 
      record.by_election === 't' ||
      record.seats_contested === '1' ||
      (record.ballot_paper_id && record.ballot_paper_id.includes('.by.'))
    
    if (isByElection) {
      result.byElectionCount++
      continue
    }
    
    // Check if gss maps to this LAD
    if (record.gss) {
      const mappedLad = wardMapping.get(record.gss.trim())
      if (mappedLad === ladCode) {
        potentialRecords.push(record)
        result.hasWardMapping = true
      }
    } else {
      result.missingGssCount++
    }
    
    // Check if organisation_name matches
    if (record.organisation_name) {
      const orgName = record.organisation_name
        .toLowerCase()
        .replace(/, city of$/, "")
        .replace(/, city$/, "")
        .replace(/ borough$/, "")
        .replace(/ district$/, "")
        .replace(/ council$/, "")
        .trim()
      
      const mappedLad = ladNameMapping.get(orgName) || ladNameMapping.get(record.organisation_name.toLowerCase())
      if (mappedLad === ladCode) {
        potentialRecords.push(record)
        result.hasOrgNameMatch = true
      }
    }
  }
  
  result.sampleRecords = potentialRecords.length
  result.hasSourceData = potentialRecords.length > 0
  
  // Identify issues
  if (!result.hasSourceData) {
    result.issues.push("No source data found in election CSVs")
  }
  
  if (!result.hasWardMapping && result.missingGssCount > 0) {
    result.issues.push(`Missing gss codes: ${result.missingGssCount} records without gss`)
  }
  
  if (!result.hasWardMapping && !result.hasOrgNameMatch && result.hasSourceData) {
    result.issues.push("organisation_name doesn't match expected format")
  }
  
  if (result.byElectionCount > 0 && result.sampleRecords === 0) {
    result.issues.push(`Only by-elections found (${result.byElectionCount} filtered out)`)
  }
  
  return result
}

// Main diagnostic function
function main() {
  console.log("🔍 Diagnosing missing LAD election data...\n")
  
  // Load processed data
  const processedPath = join(process.cwd(), "public/processed/lad_elections.json")
  if (!existsSync(processedPath)) {
    console.error("❌ Processed data file not found. Run ingestion first.")
    return
  }
  
  const processedData = JSON.parse(readFileSync(processedPath, "utf-8"))
  const processedLads = new Set(Object.keys(processedData))
  
  // Get all LADs from config
  const allLads = REGIONS.filter((r) => r.level === "LAD")
  const missingLads = allLads.filter((r) => !processedLads.has(r.code))
  
  console.log(`📊 Total LADs in config: ${allLads.length}`)
  console.log(`✅ LADs with processed data: ${processedLads.size}`)
  console.log(`❌ Missing LADs: ${missingLads.length}\n`)
  
  if (missingLads.length === 0) {
    console.log("✅ All LADs have data!")
    return
  }
  
  // Load mappings
  const wardMapping = loadWardMapping()
  const ladNameMapping = loadLadNameMapping()
  
  console.log(`✅ Loaded ${wardMapping.size} ward-to-LAD mappings`)
  console.log(`✅ Loaded ${ladNameMapping.size} LAD name mappings\n`)
  
  // Load all election records
  const years = [2022, 2023, 2024, 2025]
  const allElectionRecords: ElectionRow[] = []
  
  for (const year of years) {
    const csvPath = year === 2022 && 
      existsSync(join(process.cwd(), "public/elections/local_elections_2022_filtered_normalized.csv"))
      ? join(process.cwd(), "public/elections/local_elections_2022_filtered_normalized.csv")
      : join(process.cwd(), `public/elections/local_elections_${year}.csv`)
    
    if (existsSync(csvPath)) {
      const records = parseCSV<ElectionRow>(csvPath)
      allElectionRecords.push(...records)
      console.log(`📁 Loaded ${records.length} records from ${year}`)
    }
  }
  
  console.log(`\n📊 Total election records: ${allElectionRecords.length}\n`)
  
  // Diagnose missing LADs (focus on Cornwall and County Durham first, then sample others)
  const priorityLads = missingLads.filter((r) => 
    r.code === "E06000052" || // Cornwall
    r.code === "E06000047" || // County Durham
    r.name.toLowerCase().includes("cornwall") ||
    r.name.toLowerCase().includes("durham")
  )
  
  const otherMissingLads = missingLads.filter((r) => !priorityLads.includes(r))
  
  console.log("🔍 Diagnosing priority LADs (Cornwall, County Durham):\n")
  const priorityResults = priorityLads.map((lad) => 
    diagnoseLad(lad.code, lad.name, wardMapping, ladNameMapping, allElectionRecords)
  )
  
  for (const result of priorityResults) {
    console.log(`\n${result.ladName} (${result.ladCode}):`)
    console.log(`  Source records found: ${result.sampleRecords}`)
    console.log(`  Has ward mapping: ${result.hasWardMapping ? "✅" : "❌"}`)
    console.log(`  Has org name match: ${result.hasOrgNameMatch ? "✅" : "❌"}`)
    console.log(`  By-elections filtered: ${result.byElectionCount}`)
    console.log(`  Missing gss: ${result.missingGssCount}`)
    if (result.issues.length > 0) {
      console.log(`  Issues:`)
      result.issues.forEach((issue) => console.log(`    - ${issue}`))
    }
  }
  
  // Sample other missing LADs
  console.log(`\n\n🔍 Sampling other missing LADs (showing first 10):\n`)
  const sampleResults = otherMissingLads.slice(0, 10).map((lad) =>
    diagnoseLad(lad.code, lad.name, wardMapping, ladNameMapping, allElectionRecords)
  )
  
  for (const result of sampleResults) {
    if (result.sampleRecords > 0 || result.issues.length > 0) {
      console.log(`\n${result.ladName} (${result.ladCode}):`)
      console.log(`  Source records: ${result.sampleRecords}`)
      console.log(`  Has ward mapping: ${result.hasWardMapping ? "✅" : "❌"}`)
      console.log(`  Has org name match: ${result.hasOrgNameMatch ? "✅" : "❌"}`)
      if (result.issues.length > 0) {
        console.log(`  Issues: ${result.issues.join(", ")}`)
      }
    }
  }
  
  // Summary statistics
  console.log(`\n\n📊 Summary:\n`)
  const allResults = [...priorityResults, ...sampleResults]
  const withSourceData = allResults.filter((r) => r.hasSourceData).length
  const withWardMapping = allResults.filter((r) => r.hasWardMapping).length
  const withOrgNameMatch = allResults.filter((r) => r.hasOrgNameMatch).length
  const onlyByElections = allResults.filter((r) => r.byElectionCount > 0 && r.sampleRecords === 0).length
  
  console.log(`  LADs with source data: ${withSourceData}/${allResults.length}`)
  console.log(`  LADs with ward mapping: ${withWardMapping}/${allResults.length}`)
  console.log(`  LADs with org name match: ${withOrgNameMatch}/${allResults.length}`)
  console.log(`  LADs with only by-elections: ${onlyByElections}`)
  
  // Check for organisation_name patterns
  console.log(`\n\n🔍 Checking organisation_name patterns for missing LADs:\n`)
  const orgNames = new Set<string>()
  for (const record of allElectionRecords) {
    if (record.organisation_name) {
      orgNames.add(record.organisation_name)
    }
  }
  
  const cornwallOrgs = Array.from(orgNames).filter((n) => n.toLowerCase().includes("cornwall"))
  const durhamOrgs = Array.from(orgNames).filter((n) => n.toLowerCase().includes("durham"))
  
  if (cornwallOrgs.length > 0) {
    console.log(`Cornwall organisation names found:`)
    cornwallOrgs.forEach((n) => console.log(`  - ${n}`))
  }
  
  if (durhamOrgs.length > 0) {
    console.log(`\nDurham organisation names found:`)
    durhamOrgs.forEach((n) => console.log(`  - ${n}`))
  }
}

main()

