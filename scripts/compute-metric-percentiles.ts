/**
 * Compute national percentiles for each metric
 * 
 * Run: pnpm tsx scripts/compute-metric-percentiles.ts
 * 
 * Outputs: public/data/metric-percentiles.json
 */

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const METRICS = [
  "population_total",
  "population_16_64", 
  "nominal_gva_mn_gbp",
  "gdhi_per_head_gbp",
  "emp_total_jobs",
  "employment_rate_pct",
  "unemployment_rate_pct",
]

const TABLES = [
  { name: "itl1_latest_all", level: "ITL1" },
  { name: "itl2_latest_all", level: "ITL2" },
  { name: "itl3_latest_all", level: "ITL3" },
  { name: "lad_latest_all", level: "LAD" },
]

// -----------------------------------------------------------------------------
// Load env
// -----------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local not found")
    process.exit(1)
  }
  
  const content = fs.readFileSync(envPath, "utf-8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RegionData {
  regionCode: string
  value: number
  yoyGrowth: number | null
  year: number
}

interface PercentileData {
  p10: number
  p90: number
  min: number
  max: number
  maxRegion: string
  minRegion: string
  count: number
}

interface MetricPercentiles {
  value: PercentileData
  growth: PercentileData
  latestYear: number
}

type OutputStructure = {
  [metricId: string]: {
    [level: string]: MetricPercentiles
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

function computePercentileData(
  regions: RegionData[],
  getValue: (r: RegionData) => number | null
): PercentileData {
  const values = regions
    .map(r => ({ code: r.regionCode, val: getValue(r) }))
    .filter((v): v is { code: string; val: number } => v.val !== null && !isNaN(v.val))
  
  if (values.length === 0) {
    return { p10: 0, p90: 0, min: 0, max: 0, maxRegion: "", minRegion: "", count: 0 }
  }
  
  const nums = values.map(v => v.val)
  const minVal = Math.min(...nums)
  const maxVal = Math.max(...nums)
  const minRegion = values.find(v => v.val === minVal)?.code ?? ""
  const maxRegion = values.find(v => v.val === maxVal)?.code ?? ""
  
  return {
    p10: percentile(nums, 10),
    p90: percentile(nums, 90),
    min: minVal,
    max: maxVal,
    maxRegion,
    minRegion,
    count: values.length,
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function fetchMetricData(
  tableName: string,
  metricId: string
): Promise<RegionData[]> {
  console.log(`  📊 Fetching ${metricId} from ${tableName}...`)
  
  // Get all historical data for this metric
  const { data, error } = await supabase
    .from(tableName)
    .select("region_code, period, value, data_type")
    .eq("metric_id", metricId)
    .eq("data_type", "historical")
    .order("period", { ascending: true })
  
  if (error) {
    console.error(`  ❌ Error: ${error.message}`)
    return []
  }
  
  if (!data || data.length === 0) {
    console.log(`  ⚠️ No data found`)
    return []
  }
  
  // Group by region
  const byRegion = new Map<string, { year: number; value: number }[]>()
  for (const row of data) {
    const code = row.region_code as string
    const year = row.period as number
    const value = row.value as number
    
    if (!byRegion.has(code)) byRegion.set(code, [])
    byRegion.get(code)!.push({ year, value })
  }
  
  // For each region, get latest value and YoY growth
  const results: RegionData[] = []
  
  for (const [regionCode, points] of byRegion) {
    const sorted = points.sort((a, b) => a.year - b.year)
    const latest = sorted[sorted.length - 1]
    const previous = sorted[sorted.length - 2]
    
    if (!latest) continue
    
    let yoyGrowth: number | null = null
    if (previous && previous.value !== 0) {
      yoyGrowth = ((latest.value - previous.value) / previous.value) * 100
    }
    
    results.push({
      regionCode,
      value: latest.value,
      yoyGrowth,
      year: latest.year,
    })
  }
  
  console.log(`  ✅ ${results.length} regions`)
  return results
}

async function main() {
  console.log("🚀 Computing metric percentiles...\n")
  
  const output: OutputStructure = {}
  
  for (const metricId of METRICS) {
    console.log(`\n📈 Metric: ${metricId}`)
    output[metricId] = {}
    
    for (const table of TABLES) {
      const regions = await fetchMetricData(table.name, metricId)
      
      if (regions.length === 0) {
        console.log(`  ⏭️ Skipping ${table.level} (no data)`)
        continue
      }
      
      const latestYear = Math.max(...regions.map(r => r.year))
      
      output[metricId][table.level] = {
        value: computePercentileData(regions, r => r.value),
        growth: computePercentileData(regions, r => r.yoyGrowth),
        latestYear,
      }
      
      console.log(`  📊 ${table.level}: p10=${output[metricId][table.level].value.p10.toFixed(1)}, p90=${output[metricId][table.level].value.p90.toFixed(1)}, n=${regions.length}`)
    }
  }
  
  // Write output
  const outputPath = path.join(process.cwd(), "public/data/metric-percentiles.json")
  
  // Ensure directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ Written to ${outputPath}`)
}

main().catch(console.error)

