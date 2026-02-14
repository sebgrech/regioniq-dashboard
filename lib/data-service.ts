import { supabase } from "@/lib/supabase"
import { getCacheKey, getCached, getOrFetch } from "@/lib/cache/choropleth-cache"
import { REGIONS, YEARS, type Scenario, getDbRegionCode, getUIRegionCode, getRegion } from "./metrics.config"
import type { DataMetadata, DataResponse } from "./types"

export interface DataPoint {
  year: number
  value: number
  type: "historical" | "forecast"
  data_quality?: string | null // 'ONS', 'interpolated', or null (for forecasts)
}

export interface SeriesData {
  metricId: string
  region: string
  scenario: Scenario
  data: DataPoint[]
}

export interface ChoroplethData {
  min: number
  max: number
  values: Record<string, number>
}

const DERIVED_GVA_PER_JOB_METRIC_ID = "gva_per_job"

// Generate metadata
// Note: version/vintage should come from the Data API /version endpoint, not hard-coded here.
// This function provides fallback metadata for client-side Supabase queries.
function generateMetadata(): DataMetadata {
  return {
    version: "v1",  // API version, not forecast vintage
    lastUpdated: new Date().toISOString(),
    modelRun: "Latest ONS Regional Forecast",
    source: "ONS Regional Accounts via Supabase",
    dataQuality: 95,
    coverage: {
      historical: "Variable start-2023",
      forecast: "2024-2050",
    },
  }
}

// -----------------------------------------------------------------------------
// Core Utility Functions
// -----------------------------------------------------------------------------

/**
 * Get the appropriate Supabase table name based on region level
 */
function getTableName(regionCode: string): string {
  const region = REGIONS.find(r => r.code === regionCode)
  const level = region?.level || "ITL1"
  
  switch(level) {
    case "UK":
      return "macro_latest_all"
    case "ITL1":
      return "itl1_latest_all"
    case "ITL2":
      return "itl2_latest_all"
    case "ITL3":
      return "itl3_latest_all"
    case "LAD":
      return "lad_latest_all"
    default:
      return "itl1_latest_all"
  }
}

/**
 * Get the correct metric_id for the given region.
 * macro_latest_all uses uk_ prefixed metric IDs (e.g., uk_population_total).
 */
function getMetricIdForRegion(metricId: string, regionCode: string): string {
  const region = REGIONS.find(r => r.code === regionCode)
  if (region?.level === "UK") {
    return `uk_${metricId}`
  }
  return metricId
}

// -----------------------------------------------------------------------------
// Debug Functions
// -----------------------------------------------------------------------------

/**
 * Debug function to diagnose Supabase data issues
 */
export async function debugSupabaseQuery() {
  console.log("🔍 DEBUGGING SUPABASE QUERY")
  console.log("===========================")
  
  try {
    // Step 1: Get sample data to see exact values
    console.log("\n1️⃣ Getting sample rows from table...")
    const { data: sampleData, error: sampleError } = await supabase
      .from("itl1_latest_all")
      .select("*")
      .limit(10)
    
    if (sampleError) {
      console.error("Sample query failed:", sampleError)
      return
    }
    
    console.log("Sample row:", sampleData?.[0])
    
    // Step 2: Get unique metric_ids
    console.log("\n2️⃣ Getting unique metric_ids...")
    const { data: metricData, error: metricError } = await supabase
      .from("itl1_latest_all")
      .select("metric_id")
      .limit(500)
    
    const uniqueMetrics = [...new Set(metricData?.map(r => r.metric_id))].filter(Boolean)
    console.log("Unique metric_ids found:", uniqueMetrics)
    
    // Step 3: Get unique region_codes
    console.log("\n3️⃣ Getting unique region_codes...")
    const { data: regionData, error: regionError } = await supabase
      .from("itl1_latest_all")
      .select("region_code")
      .limit(500)
    
    const uniqueRegions = [...new Set(regionData?.map(r => r.region_code))].filter(Boolean)
    console.log("Unique region_codes found:", uniqueRegions)
    
    // Step 4: Try exact queries with values we found
    console.log("\n4️⃣ Testing specific queries...")
    
    // Test with first metric and region we find
    const testMetric = uniqueMetrics[0]
    const testRegion = uniqueRegions[0]
    
    if (testMetric && testRegion) {
      console.log(`\nTrying query with metric="${testMetric}" and region="${testRegion}"`)
      
      const { data: testData, error: testError } = await supabase
        .from("itl1_latest_all")
        .select("*")
        .eq("metric_id", testMetric)
        .eq("region_code", testRegion)
        .limit(5)
      
      if (testError) {
        console.error("Test query failed:", testError)
      } else {
        console.log(`Found ${testData?.length || 0} rows`)
        if (testData && testData.length > 0) {
          console.log("First row:", testData[0])
        }
      }
    }
    
    // Step 5: Check for specific combinations
    console.log("\n5️⃣ Checking for our expected data...")
    
    // Check if nominal_gva_mn_gbp exists
    const { data: gvaCheck } = await supabase
      .from("itl1_latest_all")
      .select("metric_id, region_code")
      .eq("metric_id", "nominal_gva_mn_gbp")
      .limit(5)
    
    console.log("Rows with nominal_gva_mn_gbp:", gvaCheck?.length || 0)
    if (gvaCheck && gvaCheck.length > 0) {
      console.log("Sample regions with GVA data:", gvaCheck.map(r => r.region_code))
    }
    
    // Check if E12000007 exists
    const { data: londonCheck } = await supabase
      .from("itl1_latest_all")
      .select("metric_id, region_code")
      .eq("region_code", "E12000007")
      .limit(5)
    
    console.log("Rows with E12000007 (London):", londonCheck?.length || 0)
    if (londonCheck && londonCheck.length > 0) {
      console.log("Sample metrics for London:", londonCheck.map(r => r.metric_id))
    }
    
    // Step 6: Try the exact combination we're looking for
    console.log("\n6️⃣ Testing exact combination: nominal_gva_mn_gbp + E12000007...")
    const { data: exactTest, error: exactError } = await supabase
      .from("itl1_latest_all")
      .select("*")
      .eq("metric_id", "nominal_gva_mn_gbp")
      .eq("region_code", "E12000007")
      .limit(5)
    
    if (exactError) {
      console.error("Exact query failed:", exactError)
    } else {
      console.log(`Found ${exactTest?.length || 0} rows for GVA + London`)
      if (exactTest && exactTest.length > 0) {
        console.log("Sample data:", exactTest[0])
      }
    }
    
    console.log("\n=== END DEBUG ===")
    
  } catch (error) {
    console.error("Debug failed:", error)
  }
}

/**
 * NI has a distinct jobs metric_id (`emp_total_jobs_ni`) and, in this dataset,
 * NI ITL1 jobs are not stored in `itl1_latest_all` at all (they exist at ITL2 `TLN0`).
 *
 * This helper normalizes the "UI metric" (`emp_total_jobs`) into the correct
 * underlying metric/table/region for querying Supabase.
 */
function resolveMetricRegionOverrides(params: {
  metricId: string
  region: string
}): { metricId: string; region: string; tableNameOverride?: string } {
  const { metricId, region } = params

  if (metricId !== "emp_total_jobs") return { metricId, region }

  const r = getRegion(region)
  if (!r) return { metricId, region }

  if (r.country !== "Northern Ireland") return { metricId, region }

  // NI uses a distinct metric id everywhere it exists.
  // Additionally, NI ITL1 jobs are stored at ITL2 (TLN0) in this dataset.
  if (r.level === "ITL1") {
    return { metricId: "emp_total_jobs_ni", region: "TLN0", tableNameOverride: "itl2_latest_all" }
  }

  return { metricId: "emp_total_jobs_ni", region }
}

// -----------------------------------------------------------------------------
// Data Fetching Functions
// -----------------------------------------------------------------------------

/**
 * Main data fetching function - dynamically queries the correct table based on region level
 * Handles scenario selection by choosing the appropriate column:
 * - baseline: value column
 * - downside: ci_lower column  
 * - upside: ci_upper column
 * Also handles ITL/LAD code to DB code conversion for regions
 */
export async function fetchSeries(params: {
  metricId: string
  region: string  // ITL/LAD code from UI (e.g., "UKI" or "E06000001")
  scenario: Scenario
}): Promise<DataPoint[]> {
  if (params.metricId === DERIVED_GVA_PER_JOB_METRIC_ID) {
    const [gvaSeries, jobsSeries] = await Promise.all([
      fetchSeries({ metricId: "nominal_gva_mn_gbp", region: params.region, scenario: params.scenario }),
      fetchSeries({ metricId: "emp_total_jobs", region: params.region, scenario: params.scenario }),
    ])

    const gvaByYear = new Map(gvaSeries.map((d) => [d.year, d]))
    const jobsByYear = new Map(jobsSeries.map((d) => [d.year, d]))
    const commonYears = Array.from(gvaByYear.keys())
      .filter((year) => jobsByYear.has(year))
      .sort((a, b) => a - b)

    return commonYears
      .map((year) => {
        const gva = gvaByYear.get(year)
        const jobs = jobsByYear.get(year)
        if (!gva || !jobs || !isFinite(gva.value) || !isFinite(jobs.value) || jobs.value <= 0) return null
        return {
          year,
          // GVA is £m, so scale to £ before dividing by jobs.
          value: (gva.value * 1_000_000) / jobs.value,
          type: gva.type === "forecast" || jobs.type === "forecast" ? "forecast" : "historical",
          data_quality: gva.data_quality ?? jobs.data_quality ?? null,
        } as DataPoint
      })
      .filter((point): point is DataPoint => point !== null)
  }

  const { scenario } = params

  // Handle NI-specific metric/table quirks (jobs metric_id + ITL1 storage)
  const resolved = resolveMetricRegionOverrides({ metricId: params.metricId, region: params.region })
  const metricId = resolved.metricId
  const region = resolved.region

  const DEBUG_FETCH = process.env.NEXT_PUBLIC_RIQ_DEBUG === "1"
  
  // Convert UI code to DB code for database query
  const dbRegionCode = getDbRegionCode(region)
  
  // Determine which table to query based on region level
  const tableName = resolved.tableNameOverride ?? getTableName(region)
  
  // Get the correct metric_id for the table (macro_latest_all uses uk_ prefix)
  const queryMetricId = getMetricIdForRegion(metricId, region)

  try {
    if (DEBUG_FETCH) {
      console.log(`🔍 Fetching from Supabase:`)
      console.log(`   Table: ${tableName}`)
      console.log(`   Metric: ${metricId} → Query Metric: ${queryMetricId}`)
      console.log(`   UI Region: ${region} → DB Region: ${dbRegionCode}`)
      console.log(`   Scenario: ${scenario}`)
    }
    
    // Query with the E-code from the appropriate table
    const { data, error } = await supabase
      .from(tableName)
      .select("period, value, ci_lower, ci_upper, data_type, data_quality")
      .eq("metric_id", queryMetricId)
      .eq("region_code", dbRegionCode)
      .order("period", { ascending: true })

    if (error) {
      console.error("❌ Supabase error:", error)
      throw new Error(`Supabase query failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ No data found`)
      console.log("Query attempted:", { 
        table: tableName,
        metric_id: queryMetricId, 
        region_code: dbRegionCode
      })
      return []
    }

    if (DEBUG_FETCH) console.log(`✅ Fetched ${data.length} rows from Supabase`)
    
    // Transform data based on scenario selection
    const transformedData: DataPoint[] = data.map(row => {
      let value: number
      
      // For historical data, always use the 'value' column
      if (row.data_type === "historical") {
        value = row.value || 0
      } else {
        // For forecast data, select column based on scenario
        switch(scenario) {
          case "baseline":
            value = row.value || 0
            break
          case "downside":
            value = row.ci_lower ?? row.value ?? 0
            break
          case "upside":
            value = row.ci_upper ?? row.value ?? 0
            break
          default:
            value = row.value || 0
        }
      }
      
      return {
        year: row.period,
        value: value,
        type: row.data_type as "historical" | "forecast",
        data_quality: row.data_quality ?? null
      }
    })

    console.log(`📊 Returning ${transformedData.length} data points for ${scenario} scenario`)
    return transformedData

  } catch (error) {
    console.error("💥 fetchSeries failed:", error)
    throw error
  }
}

/**
 * Fetch data with metadata wrapper
 */
export async function fetchSeriesWithMetadata(params: {
  metricId: string
  region: string
  scenario: Scenario
}): Promise<DataResponse<DataPoint[]>> {
  const data = await fetchSeries(params)
  const metadata = generateMetadata()
  return { data, metadata }
}

/**
 * Fetch choropleth map data for all regions at a specific year
 * Returns data with ITL/LAD codes for UI display
 */
export async function fetchChoropleth(params: {
  metricId: string
  level: string  // "UK", "ITL1", "ITL2", "ITL3", or "LAD"
  year: number
  scenario: Scenario
}): Promise<ChoroplethData> {
  const { level, year, scenario } = params
  const metricId = params.metricId

  if (metricId === DERIVED_GVA_PER_JOB_METRIC_ID) {
    const [gvaData, jobsData] = await Promise.all([
      fetchChoropleth({ metricId: "nominal_gva_mn_gbp", level, year, scenario }),
      fetchChoropleth({ metricId: "emp_total_jobs", level, year, scenario }),
    ])

    const values: Record<string, number> = {}
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    Object.entries(gvaData.values).forEach(([code, gva]) => {
      const jobs = jobsData.values[code]
      if (!isFinite(gva) || !isFinite(jobs) || jobs <= 0) return
      const value = (gva * 1_000_000) / jobs
      values[code] = value
      min = Math.min(min, value)
      max = Math.max(max, value)
    })

    if (Object.keys(values).length === 0) {
      return { min: 0, max: 0, values: {} }
    }

    return { min, max, values }
  }

  // Determine table name based on level
  const tableName = level === "UK" ? "macro_latest_all" :
                    level === "ITL1" ? "itl1_latest_all" :
                    level === "ITL2" ? "itl2_latest_all" :
                    level === "ITL3" ? "itl3_latest_all" :
                    level === "LAD" ? "lad_latest_all" :
                    "itl1_latest_all"

  const cacheKey = getCacheKey(["choropleth", level, metricId, year, scenario])
  const cached = getCached<ChoroplethData>(cacheKey)
  if (cached) return cached

  try {
    console.log(`🗺️ Fetching choropleth data:`)
    console.log(`   Table: ${tableName}`)
    console.log(`   Metric: ${metricId}`)
    console.log(`   Year: ${year}`)
    console.log(`   Scenario: ${scenario}`)
    
    const result = await getOrFetch<ChoroplethData>(cacheKey, async () => {
    const values: Record<string, number> = {}
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

      const ingestRows = (rows: any[] | null | undefined) => {
        if (!rows || rows.length === 0) return
        rows.forEach((row) => {
        let value: number
        
          // Select appropriate column based on scenario (historical always uses value)
        if (row.data_type === "historical") {
          value = row.value || 0
        } else {
            switch (scenario) {
            case "baseline":
              value = row.value || 0
              break
            case "downside":
              value = row.ci_lower ?? row.value ?? 0
              break
            case "upside":
              value = row.ci_upper ?? row.value ?? 0
              break
            default:
              value = row.value || 0
          }
        }
        
        const uiCode = getUIRegionCode(row.region_code)
        values[uiCode] = value
        min = Math.min(min, value)
        max = Math.max(max, value)
      })
    }

      // Special-case: NI jobs use `emp_total_jobs_ni`, and NI ITL1 jobs live in ITL2 (TLN0).
      if (metricId === "emp_total_jobs") {
        // 1) Pull the standard metric for all non-NI regions at the requested level.
        const { data: baseRows, error: baseErr } = await supabase
          .from(tableName)
          .select("region_code, value, ci_lower, ci_upper, data_type")
          .eq("metric_id", "emp_total_jobs")
          .eq("period", year)

        if (baseErr) {
          console.error("❌ Choropleth query failed:", baseErr)
          throw baseErr
        }
        ingestRows(baseRows)

        if (level === "ITL1") {
          // 2) Patch in UKN from TLN0 jobs (stored at ITL2 in this dataset)
          const { data: niRows, error: niErr } = await supabase
            .from("itl2_latest_all")
            .select("region_code, value, ci_lower, ci_upper, data_type")
            .eq("metric_id", "emp_total_jobs_ni")
            .eq("period", year)
            .eq("region_code", "TLN0")
            .limit(1)

          if (niErr) {
            console.error("❌ NI jobs patch query failed:", niErr)
            throw niErr
          }

          // Ingest as-is, then remap TLN0 -> UKN in the output map.
          // (getUIRegionCode("TLN0") returns "TLN0", so we override explicitly.)
          if (niRows && niRows.length > 0) {
            const row = niRows[0]
            // compute value with same logic used by ingestRows
            let v: number
            if (row.data_type === "historical") v = row.value || 0
            else if (scenario === "downside") v = row.ci_lower ?? row.value ?? 0
            else if (scenario === "upside") v = row.ci_upper ?? row.value ?? 0
            else v = row.value || 0

            values["UKN"] = v
            min = Math.min(min, v)
            max = Math.max(max, v)
          }
        } else {
          // 2) Merge in NI rows stored under emp_total_jobs_ni at this level.
          const { data: niRows, error: niErr } = await supabase
            .from(tableName)
            .select("region_code, value, ci_lower, ci_upper, data_type")
            .eq("metric_id", "emp_total_jobs_ni")
            .eq("period", year)

          if (niErr) {
            console.error("❌ Choropleth NI query failed:", niErr)
            throw niErr
          }
          ingestRows(niRows)
        }
      } else {
        // Default path: single metric_id query
        const { data, error } = await supabase
          .from(tableName)
          .select("region_code, value, ci_lower, ci_upper, data_type")
          .eq("metric_id", metricId)
          .eq("period", year)

        if (error) {
          console.error("❌ Choropleth query failed:", error)
          throw error
        }
        ingestRows(data)
      }

    console.log(`🗺️ Choropleth data: ${Object.keys(values).length} regions (UI codes)`)
    return { min, max, values }
    })

    return result

  } catch (error) {
    console.error("💥 fetchChoropleth failed:", error)
    return { min: 0, max: 0, values: {} }
  }
}

/**
 * Fetch choropleth with metadata wrapper
 */
export async function fetchChoroplethWithMetadata(params: {
  metricId: string
  level: string
  year: number
  scenario: Scenario
}): Promise<DataResponse<ChoroplethData>> {
  const data = await fetchChoropleth(params)
  const metadata = generateMetadata()
  return { data, metadata }
}

// -----------------------------------------------------------------------------
// Metadata/Inspection Functions
// -----------------------------------------------------------------------------

/**
 * Test Supabase connection and show available data
 * Tests all available tables (ITL1, ITL2, ITL3, LAD, Macro)
 */
export async function testSupabaseConnection(): Promise<boolean> {
  // UPDATED TO INCLUDE LAD
  const tables = ["itl1_latest_all", "itl2_latest_all", "itl3_latest_all", "lad_latest_all", "macro_latest_all"]
  
  try {
    console.log("🧪 Testing Supabase connections...")
    
    for (const table of tables) {
      console.log(`\n📊 Testing ${table}...`)
      
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(100)

      if (error) {
        console.error(`❌ ${table} connection failed:`, error)
        continue
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ ${table} is empty or inaccessible`)
        continue
      }

      console.log(`✅ ${table} connection successful!`)
      console.log(`📊 Found ${data.length} sample rows`)
      
      // Analyze available data
      const metrics = [...new Set(data.map(row => row.metric_id))].filter(Boolean)
      const regions = [...new Set(data.map(row => row.region_code))].filter(Boolean)
      const dataTypes = [...new Set(data.map(row => row.data_type))].filter(Boolean)
      const years = [...new Set(data.map(row => row.period))].filter(Boolean).sort((a, b) => a - b)
      
      console.log("\n📈 Available Data Summary:")
      console.log("=========================")
      console.log("Metrics:", metrics)
      console.log("Regions:", regions.slice(0, 10), regions.length > 10 ? `... (${regions.length} total)` : "")
      console.log("Data Types:", dataTypes)
      console.log("Year Range:", years.length > 0 ? `${years[0]} - ${years[years.length - 1]}` : "No years found")
    }
    
    return true
    
  } catch (error) {
    console.error("💥 Connection test failed:", error)
    return false
  }
}

/**
 * Get available metrics from the database
 */
export async function getAvailableMetrics(level: string = "ITL1"): Promise<string[]> {
  const tableName = level === "UK" ? "macro_latest_all" :
                    level === "ITL1" ? "itl1_latest_all" :
                    level === "ITL2" ? "itl2_latest_all" :
                    level === "ITL3" ? "itl3_latest_all" :
                    level === "LAD" ? "lad_latest_all" :
                    "itl1_latest_all"
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("metric_id")
      .limit(1000)

    if (error) throw error
    
    const metrics = [...new Set(data?.map(row => row.metric_id) || [])].filter(Boolean)
    console.log(`📊 Available metrics in ${tableName}:`, metrics)
    return metrics
    
  } catch (error) {
    console.error("Failed to get available metrics:", error)
    return []
  }
}

/**
 * Get available regions from the database (returns UI codes)
 */
export async function getAvailableRegions(level: string = "ITL1"): Promise<string[]> {
  const tableName = level === "UK" ? "macro_latest_all" :
                    level === "ITL1" ? "itl1_latest_all" :
                    level === "ITL2" ? "itl2_latest_all" :
                    level === "ITL3" ? "itl3_latest_all" :
                    level === "LAD" ? "lad_latest_all" :
                    "itl1_latest_all"
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("region_code, region_name")
      .limit(1000)

    if (error) throw error
    
    // Get DB codes from database
    const dbCodes = [...new Set(data?.map(row => row.region_code) || [])].filter(Boolean)
    
    // Convert to UI codes
    const uiCodes = dbCodes.map(dbCode => getUIRegionCode(dbCode))
    
    console.log(`🏴 Available ${level} regions:`)
    console.log("DB codes in database:", dbCodes.slice(0, 10), dbCodes.length > 10 ? `... (${dbCodes.length} total)` : "")
    console.log("UI codes:", uiCodes.slice(0, 10), uiCodes.length > 10 ? `... (${uiCodes.length} total)` : "")
    
    return uiCodes
    
  } catch (error) {
    console.error("Failed to get available regions:", error)
    return []
  }
}

/**
 * Verify data exists for a specific combination
 */
export async function verifyDataExists(metricId: string, regionCode: string): Promise<boolean> {
  const dbRegionCode = getDbRegionCode(regionCode)
  const tableName = getTableName(regionCode)
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("metric_id")
      .eq("metric_id", metricId)
      .eq("region_code", dbRegionCode)
      .limit(1)
    
    if (error) {
      console.error("Verification query failed:", error)
      return false
    }
    
    const exists = data && data.length > 0
    
    if (!exists) {
      console.warn(`No data for metric="${metricId}", region="${regionCode}" (${dbRegionCode}) in ${tableName}`)
    }
    
    return exists
  } catch (error) {
    console.error("Failed to verify data:", error)
    return false
  }
}

// -----------------------------------------------------------------------------
// UI Formatting / Calculation Functions
// -----------------------------------------------------------------------------

export function formatValue(value: number, unit: string, decimals = 0): string {
  const absValue = Math.abs(value)

  // Special handling for GDHI per head (it's already in £, not millions)
  if (unit === "£") {
    if (absValue >= 1e3) {
      return `£${(value / 1e3).toFixed(decimals)}K`
    }
    return `£${value.toLocaleString()}`
  }

  // For millions of pounds
  if (unit === "£m") {
    if (absValue >= 1e3) {
      return `£${(value / 1e3).toFixed(decimals)}B`
    }
    // Round to whole number for clean display (68.208M → £68M)
    return `£${Math.round(value).toLocaleString()}M`
  }

  // For people/jobs
  if (unit === "people" || unit === "jobs") {
    if (absValue >= 1e9) {
      // For population, round to whole number. For jobs, remove trailing .0
      if (unit === "people") {
        return `${Math.round(value / 1e9)}B ${unit}`
      }
      const formatted = (value / 1e9).toFixed(decimals)
      return `${parseFloat(formatted).toString()}B ${unit}`
    } else if (absValue >= 1e6) {
      // For population, round to whole number. For jobs, remove trailing .0
      if (unit === "people") {
        return `${Math.round(value / 1e6)}M ${unit}`
      }
      const formatted = (value / 1e6).toFixed(decimals)
      return `${parseFloat(formatted).toString()}M ${unit}`
    } else if (absValue >= 1e3) {
      // For population, round to whole number. For jobs, remove trailing .0
      if (unit === "people") {
        return `${Math.round(value / 1e3)}K ${unit}`
      }
      const formatted = (value / 1e3).toFixed(decimals)
      return `${parseFloat(formatted).toString()}K ${unit}`
    }
    // For values < 1k, show decimals only for population < 100k
    if (unit === "people" && absValue < 1e5) {
      return `${value.toFixed(decimals)} ${unit}`
    }
    return `${value.toLocaleString()} ${unit}`
  }

  // Default formatting
  if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B ${unit}`
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M ${unit}`
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K ${unit}`
  }

  return `${value.toLocaleString()} ${unit}`
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} hours ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} days ago`

  return date.toLocaleDateString()
}

/**
 * Fetch UK average time series for a metric
 * Aggregates across all ITL1 regions for each year
 */
export async function fetchUKSeries(params: {
  metricId: string
  scenario: Scenario
}): Promise<DataPoint[]> {
  const { metricId, scenario } = params

  try {
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("period, value, ci_lower, ci_upper, data_type")
      .eq("metric_id", metricId)
      .order("period", { ascending: true })

    if (error || !data || data.length === 0) {
      return []
    }

    // Group by year and calculate averages
    const yearMap = new Map<number, number[]>()
    
    data.forEach((row) => {
      let value: number
      if (row.data_type === "historical") {
        value = row.value || 0
      } else {
        switch (scenario) {
          case "baseline":
            value = row.value || 0
            break
          case "downside":
            value = row.ci_lower ?? row.value ?? 0
            break
          case "upside":
            value = row.ci_upper ?? row.value ?? 0
            break
          default:
            value = row.value || 0
        }
      }

      const year = row.period
      if (!yearMap.has(year)) {
        yearMap.set(year, [])
      }
      yearMap.get(year)!.push(value)
    })

    // Calculate averages and create DataPoint array
    const result: DataPoint[] = Array.from(yearMap.entries())
      .map(([year, values]) => {
        const sum = values.reduce((acc, val) => acc + val, 0)
        const avg = values.length > 0 ? sum / values.length : 0
        
        // Determine type (assume historical if year <= 2023, forecast otherwise)
        const type: "historical" | "forecast" = year <= 2023 ? "historical" : "forecast"
        
        return {
          year,
          value: avg,
          type,
        }
      })
      .sort((a, b) => a.year - b.year)

    return result
  } catch (error) {
    console.error("Error fetching UK series:", error)
    return []
  }
}