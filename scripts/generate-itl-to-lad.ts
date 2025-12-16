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

interface ITLToLadMapping {
  ITL1: Record<string, string[]>
  ITL2: Record<string, string[]>
  ITL3: Record<string, string[]>
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
  console.log("🚀 Generating ITL to LAD mapping...\n")
  
  const csvPath = join(process.cwd(), "public/reference/master_2025_geography_lookup.csv")
  const records = parseCSV<Record<string, string>>(csvPath)
  console.log(`   Found ${records.length} geography records`)
  
  const mapping: ITLToLadMapping = {
    ITL1: {},
    ITL2: {},
    ITL3: {},
  }
  
  // Process each record
  for (const record of records) {
    const itl1Code = record.ITL125CD || ""
    const itl2Code = record.ITL225CD || ""
    const itl3Code = record.ITL325CD || ""
    const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
    
    if (!ladCode) continue
    
    // Map ITL1 to LAD
    if (itl1Code && !mapping.ITL1[itl1Code]) {
      mapping.ITL1[itl1Code] = []
    }
    if (itl1Code && !mapping.ITL1[itl1Code].includes(ladCode)) {
      mapping.ITL1[itl1Code].push(ladCode)
    }
    
    // Map ITL2 to LAD
    if (itl2Code && !mapping.ITL2[itl2Code]) {
      mapping.ITL2[itl2Code] = []
    }
    if (itl2Code && !mapping.ITL2[itl2Code].includes(ladCode)) {
      mapping.ITL2[itl2Code].push(ladCode)
    }
    
    // Map ITL3 to LAD
    if (itl3Code && !mapping.ITL3[itl3Code]) {
      mapping.ITL3[itl3Code] = []
    }
    if (itl3Code && !mapping.ITL3[itl3Code].includes(ladCode)) {
      mapping.ITL3[itl3Code].push(ladCode)
    }
  }
  
  // Sort LAD codes for consistency
  for (const level of ["ITL1", "ITL2", "ITL3"] as const) {
    for (const code in mapping[level]) {
      mapping[level][code].sort()
    }
  }
  
  // Generate JSON file
  const outputPath = join(process.cwd(), "public/processed/itl_to_lad.json")
  writeFileSync(outputPath, JSON.stringify(mapping, null, 2), "utf-8")
  
  console.log(`\n✅ Successfully generated ${outputPath}`)
  console.log(`   ITL1 regions: ${Object.keys(mapping.ITL1).length}`)
  console.log(`   ITL2 regions: ${Object.keys(mapping.ITL2).length}`)
  console.log(`   ITL3 regions: ${Object.keys(mapping.ITL3).length}`)
  
  // Print sample
  const sampleITL2 = Object.keys(mapping.ITL2)[0]
  if (sampleITL2) {
    console.log(`\n📋 Sample ITL2 mapping (${sampleITL2}):`)
    console.log(`   ${mapping.ITL2[sampleITL2].length} LAD(s)`)
  }
}

// Run
main()

