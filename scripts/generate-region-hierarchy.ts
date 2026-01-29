import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

/**
 * Generate Region Hierarchy from Master Geography CSV
 * 
 * This script parses master_2025_geography_lookup.csv and generates a comprehensive
 * region hierarchy JSON that enables auto-discovery of:
 * - Parent regions (e.g., ITL3 → ITL2 → ITL1)
 * - Child regions (e.g., ITL1 → all ITL2s → all ITL3s)
 * - Sibling regions (e.g., all ITL2s in the same ITL1)
 * - Region names and metadata
 */

// TL prefix to UK prefix mapping (for ITL1)
const TL_TO_UK: Record<string, string> = {
  TLC: "UKC", // North East
  TLD: "UKD", // North West
  TLE: "UKE", // Yorkshire and The Humber
  TLF: "UKF", // East Midlands
  TLG: "UKG", // West Midlands
  TLH: "UKH", // East of England
  TLI: "UKI", // London
  TLJ: "UKJ", // South East
  TLK: "UKK", // South West
  TLL: "UKL", // Wales
  TLM: "UKM", // Scotland
  TLN: "UKN", // Northern Ireland
}

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

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

interface RegionInfo {
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
  // Index by code for O(1) lookup
  regions: Record<string, RegionInfo>
  // Lists by level for iteration
  byLevel: {
    ITL1: string[]
    ITL2: string[]
    ITL3: string[]
    LAD: string[]
  }
  // Quick parent → children lookup
  parentToChildren: {
    ITL1ToITL2: Record<string, string[]>
    ITL2ToITL3: Record<string, string[]>
    ITL3ToLAD: Record<string, string[]>
  }
  // Metadata
  meta: {
    generatedAt: string
    sourceFile: string
    totalRegions: number
  }
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
  console.log("🚀 Generating Region Hierarchy from Master CSV...\n")

  const csvPath = join(process.cwd(), "public/reference/master_2025_geography_lookup.csv")
  const records = parseCSV<Record<string, string>>(csvPath)
  console.log(`   Found ${records.length} geography records`)

  // Collectors
  const itl1Map = new Map<string, { name: string; itl2s: Set<string>; lads: Set<string> }>()
  const itl2Map = new Map<string, { name: string; itl1: string; itl1Name: string; itl3s: Set<string>; lads: Set<string> }>()
  const itl3Map = new Map<string, { name: string; itl2: string; itl2Name: string; itl1: string; itl1Name: string; lads: Set<string> }>()
  const ladMap = new Map<string, { name: string; itl3: string; itl3Name: string; itl2: string; itl2Name: string; itl1: string; itl1Name: string }>()

  // Process each record
  for (const record of records) {
    const itl1Code = record.ITL125CD || ""
    const itl1Name = record.ITL125NM || ""
    const itl2Code = record.ITL225CD || ""
    const itl2Name = record.ITL225NM || ""
    const itl3Code = record.ITL325CD || ""
    const itl3Name = record.ITL325NM || ""
    const ladCode = record.LAD25CD || record["﻿LAD25CD"] || ""
    const ladName = record.LAD25NM || record["﻿LAD25NM"] || ""

    if (!ladCode) continue

    // ITL1
    if (itl1Code) {
      if (!itl1Map.has(itl1Code)) {
        itl1Map.set(itl1Code, { name: itl1Name, itl2s: new Set(), lads: new Set() })
      }
      const itl1 = itl1Map.get(itl1Code)!
      if (itl2Code) itl1.itl2s.add(itl2Code)
      itl1.lads.add(ladCode)
    }

    // ITL2
    if (itl2Code) {
      if (!itl2Map.has(itl2Code)) {
        itl2Map.set(itl2Code, { name: itl2Name, itl1: itl1Code, itl1Name, itl3s: new Set(), lads: new Set() })
      }
      const itl2 = itl2Map.get(itl2Code)!
      if (itl3Code) itl2.itl3s.add(itl3Code)
      itl2.lads.add(ladCode)
    }

    // ITL3
    if (itl3Code) {
      if (!itl3Map.has(itl3Code)) {
        itl3Map.set(itl3Code, { name: itl3Name, itl2: itl2Code, itl2Name, itl1: itl1Code, itl1Name, lads: new Set() })
      }
      itl3Map.get(itl3Code)!.lads.add(ladCode)
    }

    // LAD
    if (ladCode && !ladMap.has(ladCode)) {
      ladMap.set(ladCode, { name: ladName, itl3: itl3Code, itl3Name, itl2: itl2Code, itl2Name, itl1: itl1Code, itl1Name })
    }
  }

  // Build hierarchy
  const hierarchy: RegionHierarchy = {
    regions: {},
    byLevel: {
      ITL1: [],
      ITL2: [],
      ITL3: [],
      LAD: [],
    },
    parentToChildren: {
      ITL1ToITL2: {},
      ITL2ToITL3: {},
      ITL3ToLAD: {},
    },
    meta: {
      generatedAt: new Date().toISOString(),
      sourceFile: "master_2025_geography_lookup.csv",
      totalRegions: 0,
    },
  }

  // Process ITL1 regions
  for (const [code, data] of itl1Map) {
    // Convert TL* to UK* for app compatibility
    const appCode = TL_TO_UK[code] || code
    const itl2Children = Array.from(data.itl2s).sort()
    const siblings = Array.from(itl1Map.keys())
      .filter(c => c !== code)
      .map(c => TL_TO_UK[c] || c)
      .sort()

    hierarchy.regions[appCode] = {
      code: appCode,
      name: data.name,
      level: "ITL1",
      parentCode: null,
      parentName: null,
      children: itl2Children,
      siblings,
      lads: Array.from(data.lads).sort(),
    }

    hierarchy.byLevel.ITL1.push(appCode)
    hierarchy.parentToChildren.ITL1ToITL2[appCode] = itl2Children
  }

  // Process ITL2 regions
  for (const [code, data] of itl2Map) {
    const parentCode = TL_TO_UK[data.itl1] || data.itl1
    const itl3Children = Array.from(data.itl3s).sort()

    // Find siblings (same ITL1 parent)
    const siblings = Array.from(itl2Map.entries())
      .filter(([c, d]) => c !== code && d.itl1 === data.itl1)
      .map(([c]) => c)
      .sort()

    hierarchy.regions[code] = {
      code,
      name: data.name,
      level: "ITL2",
      parentCode,
      parentName: data.itl1Name,
      children: itl3Children,
      siblings,
      lads: Array.from(data.lads).sort(),
    }

    hierarchy.byLevel.ITL2.push(code)
    hierarchy.parentToChildren.ITL2ToITL3[code] = itl3Children
  }

  // Process ITL3 regions
  for (const [code, data] of itl3Map) {
    const ladChildren = Array.from(data.lads).sort()

    // Find siblings (same ITL2 parent)
    const siblings = Array.from(itl3Map.entries())
      .filter(([c, d]) => c !== code && d.itl2 === data.itl2)
      .map(([c]) => c)
      .sort()

    hierarchy.regions[code] = {
      code,
      name: data.name,
      level: "ITL3",
      parentCode: data.itl2,
      parentName: data.itl2Name,
      children: ladChildren,
      siblings,
      lads: ladChildren,
    }

    hierarchy.byLevel.ITL3.push(code)
    hierarchy.parentToChildren.ITL3ToLAD[code] = ladChildren
  }

  // Process LAD regions
  for (const [code, data] of ladMap) {
    // Find siblings (same ITL3 parent)
    const siblings = Array.from(ladMap.entries())
      .filter(([c, d]) => c !== code && d.itl3 === data.itl3)
      .map(([c]) => c)
      .sort()

    hierarchy.regions[code] = {
      code,
      name: data.name,
      level: "LAD",
      parentCode: data.itl3,
      parentName: data.itl3Name,
      children: [],
      siblings,
      lads: [code],
    }

    hierarchy.byLevel.LAD.push(code)
  }

  // Sort all level arrays
  hierarchy.byLevel.ITL1.sort()
  hierarchy.byLevel.ITL2.sort()
  hierarchy.byLevel.ITL3.sort()
  hierarchy.byLevel.LAD.sort()

  hierarchy.meta.totalRegions =
    hierarchy.byLevel.ITL1.length +
    hierarchy.byLevel.ITL2.length +
    hierarchy.byLevel.ITL3.length +
    hierarchy.byLevel.LAD.length

  // Write output
  const outputPath = join(process.cwd(), "public/processed/region-hierarchy.json")
  writeFileSync(outputPath, JSON.stringify(hierarchy, null, 2), "utf-8")

  console.log(`\n✅ Successfully generated ${outputPath}`)
  console.log(`   ITL1 regions: ${hierarchy.byLevel.ITL1.length}`)
  console.log(`   ITL2 regions: ${hierarchy.byLevel.ITL2.length}`)
  console.log(`   ITL3 regions: ${hierarchy.byLevel.ITL3.length}`)
  console.log(`   LAD regions: ${hierarchy.byLevel.LAD.length}`)
  console.log(`   Total: ${hierarchy.meta.totalRegions}`)

  // Print sample
  const sampleITL2 = hierarchy.byLevel.ITL2[0]
  if (sampleITL2) {
    const sample = hierarchy.regions[sampleITL2]
    console.log(`\n📋 Sample ITL2 (${sampleITL2} - ${sample.name}):`)
    console.log(`   Parent: ${sample.parentCode} (${sample.parentName})`)
    console.log(`   Children: ${sample.children.length} ITL3s`)
    console.log(`   Siblings: ${sample.siblings.length} other ITL2s`)
    console.log(`   LADs: ${sample.lads.length}`)
  }
}

// Run
main()
