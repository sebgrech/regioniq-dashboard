import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

// Types
interface GeographyRow {
  ITL125CD: string
  ITL125NM: string
  ITL225CD: string
  ITL225NM: string
  ITL325CD: string
  ITL325NM: string
  LAU125CD: string
  LAU125NM: string
  LAD25CD: string
  LAD25NM: string
}

// City mappings - direct LAD name matches
const CITY_LAD_MAPPINGS: Record<string, string[]> = {
  // England - direct matches
  Birmingham: ["E08000025"],
  Leeds: ["E08000035"],
  Liverpool: ["E08000012"],
  Sheffield: ["E08000019"],
  Nottingham: ["E06000018"],
  Bristol: ["E06000023"],
  "Newcastle": ["E08000021"], // Newcastle upon Tyne
  Southampton: ["E06000045"],
  Portsmouth: ["E06000044"],
  Leicester: ["E06000016"],
  Coventry: ["E08000026"],
  "Stoke-on-Trent": ["E06000021"],
  Derby: ["E06000015"],
  Plymouth: ["E06000026"],
  Norwich: ["E07000148"],
  Reading: ["E06000038"],
  
  // Scotland
  Glasgow: ["S12000049"], // Glasgow City
  Edinburgh: ["S12000036"], // City of Edinburgh
  Aberdeen: ["S12000033"], // Aberdeen City
  Dundee: ["S12000042"], // Dundee City
  
  // Wales
  Cardiff: ["W06000015"],
  Swansea: ["W06000011"],
  
  // Northern Ireland
  Belfast: ["N09000003"],
}

// ITL2 groupings for metropolitan areas
const METROPOLITAN_AREAS: Record<string, string> = {
  "Manchester": "Greater Manchester", // ITL225NM
  "London": "London", // Special case - all E09 codes
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

// Main function
function main() {
  console.log("🚀 Generating city regions config...\n")
  
  const csvPath = join(process.cwd(), "public/reference/master_2025_geography_lookup.csv")
  const records = parseCSV<Record<string, string>>(csvPath)
  console.log(`   Found ${records.length} geography records`)
  
  const cityRegions: Record<string, string[]> = {}
  
  // 1. Handle London - all E09 codes
  const londonLads: string[] = []
  for (const record of records) {
    const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
    if (ladCode.startsWith("E09")) {
      londonLads.push(ladCode)
    }
  }
  if (londonLads.length > 0) {
    cityRegions["London"] = [...new Set(londonLads)].sort()
    console.log(`   ✅ London: ${cityRegions["London"].length} boroughs`)
  }
  
  // 2. Handle Manchester - all Greater Manchester boroughs (ITL225NM = "Greater Manchester")
  const manchesterLads: string[] = []
  for (const record of records) {
    const itl2Name = record.ITL225NM || ""
    const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
    if (itl2Name === "Greater Manchester" && ladCode) {
      manchesterLads.push(ladCode)
    }
  }
  if (manchesterLads.length > 0) {
    cityRegions["Manchester"] = [...new Set(manchesterLads)].sort()
    console.log(`   ✅ Manchester: ${cityRegions["Manchester"].length} boroughs`)
  }
  
  // 3. Handle direct city matches - use exact LAD codes only
  for (const [cityName, expectedLads] of Object.entries(CITY_LAD_MAPPINGS)) {
    const foundLads: string[] = []
    
    // Build a set of all LAD codes from CSV for validation
    const allLadCodes = new Set<string>()
    for (const record of records) {
      const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
      if (ladCode) {
        allLadCodes.add(ladCode)
      }
    }
    
    // Only include LAD codes that exist in the CSV and match our expected list
    for (const expectedLad of expectedLads) {
      if (allLadCodes.has(expectedLad)) {
        foundLads.push(expectedLad)
      }
    }
    
    if (foundLads.length > 0) {
      cityRegions[cityName] = [...new Set(foundLads)].sort()
      console.log(`   ✅ ${cityName}: ${foundLads.length} LAD(s)`)
    } else {
      console.warn(`   ⚠️  ${cityName}: No LADs found`)
    }
  }
  
  // Generate TypeScript file
  const outputPath = join(process.cwd(), "lib/city-regions.ts")
  const output = `/**
 * City Regions Configuration
 * 
 * Maps major UK city names to their constituent LAD (Local Authority District) codes.
 * Generated from master_2025_geography_lookup.csv
 * 
 * Last generated: ${new Date().toISOString()}
 */

export const CITY_REGIONS: Record<string, string[]> = {
${Object.entries(cityRegions)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([city, lads]) => {
    const ladsStr = lads.map((lad) => `    "${lad}"`).join(",\n")
    return `  "${city}": [\n${ladsStr}\n  ],`
  })
  .join("\n\n")}
}

/**
 * Get LAD codes for a city
 * @param cityName - Name of the city (e.g., "Manchester", "London")
 * @returns Array of LAD codes, or empty array if city not found
 */
export function getCityLads(cityName: string): string[] {
  return CITY_REGIONS[cityName] || []
}

/**
 * Check if a LAD code belongs to a city
 * @param ladCode - LAD code to check
 * @param cityName - Name of the city
 * @returns True if LAD belongs to the city
 */
export function isLadInCity(ladCode: string, cityName: string): boolean {
  const cityLads = CITY_REGIONS[cityName]
  return cityLads ? cityLads.includes(ladCode) : false
}

/**
 * Get city name for a LAD code
 * @param ladCode - LAD code to look up
 * @returns City name if found, null otherwise
 */
export function getCityForLad(ladCode: string): string | null {
  for (const [city, lads] of Object.entries(CITY_REGIONS)) {
    if (lads.includes(ladCode)) {
      return city
    }
  }
  return null
}
`

  writeFileSync(outputPath, output, "utf-8")
  
  console.log(`\n✅ Successfully generated ${outputPath}`)
  console.log(`   Total cities: ${Object.keys(cityRegions).length}`)
  console.log(`   Total LADs mapped: ${Object.values(cityRegions).reduce((sum, lads) => sum + lads.length, 0)}`)
  
  // Print summary
  console.log("\n📋 City regions summary:")
  for (const [city, lads] of Object.entries(cityRegions).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`   ${city}: ${lads.length} LAD(s)`)
  }
}

// Run
main()

