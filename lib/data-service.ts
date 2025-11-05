import { supabase } from "@/lib/supabase"
import { REGIONS, YEARS, type Scenario, getDbRegionCode, getUIRegionCode } from "./metrics.config"
import type { DataMetadata, DataResponse } from "./types"

export interface DataPoint {
  year: number
  value: number
  type: "historical" | "forecast"
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

// Generate metadata
function generateMetadata(): DataMetadata {
  return {
    version: "2024-Q4",
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
 * Main data fetching function - connects to your itl1_latest_all table
 * Handles scenario selection by choosing the appropriate column:
 * - baseline: value column
 * - downside: ci_lower column  
 * - upside: ci_upper column
 * Also handles ITL to E-code conversion for regions
 */
export async function fetchSeries(params: {
  metricId: string
  region: string  // ITL code from UI (e.g., "UKI")
  scenario: Scenario
}): Promise<DataPoint[]> {
  const { metricId, region, scenario } = params
  
  // Convert ITL code to E-code for database query
  const dbRegionCode = getDbRegionCode(region)

  try {
    console.log(`🔍 Fetching from Supabase:`)
    console.log(`   Metric: ${metricId}`)
    console.log(`   UI Region: ${region} → DB Region: ${dbRegionCode}`)
    console.log(`   Scenario: ${scenario}`)
    
    // Query with the E-code
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("period, value, ci_lower, ci_upper, data_type")
      .eq("metric_id", metricId)
      .eq("region_code", dbRegionCode)  // Use E-code here
      .order("period", { ascending: true })

    if (error) {
      console.error("❌ Supabase error:", error)
      throw new Error(`Supabase query failed: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.warn(`⚠️ No data found`)
      console.log("Query attempted:", { 
        table: "itl1_latest_all",
        metric_id: metricId, 
        region_code: dbRegionCode
      })
      return []
    }

    console.log(`✅ Fetched ${data.length} rows from Supabase`)
    
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
        type: row.data_type as "historical" | "forecast"
      }
    })

    console.log(`📊 Returning ${transformedData.length} data points for ${scenario} scenario`)
    return transformedData

  } catch (error) {
    console.error("💥 fetchSeries failed:", error)
    throw error // Don't fall back to mock data - fail explicitly
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
 * Returns data with ITL codes for UI display
 */
export async function fetchChoropleth(params: {
  metricId: string
  level: string
  year: number
  scenario: Scenario
}): Promise<ChoroplethData> {
  const { metricId, year, scenario } = params

  try {
    console.log(`🗺️ Fetching choropleth data for ${metricId} at year ${year}, scenario ${scenario}`)
    
    // Fetch all regions for this metric and year
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("region_code, value, ci_lower, ci_upper, data_type")
      .eq("metric_id", metricId)
      .eq("period", year)

    if (error) {
      console.error("❌ Choropleth query failed:", error)
      throw error
    }

    const values: Record<string, number> = {}
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    if (data && data.length > 0) {
      // Process each region's data
      data.forEach(row => {
        let value: number
        
        // Select appropriate column based on scenario
        if (row.data_type === "historical") {
          value = row.value || 0
        } else {
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
        
        // Convert E-code back to ITL for UI
        const itlCode = getUIRegionCode(row.region_code)
        values[itlCode] = value
        min = Math.min(min, value)
        max = Math.max(max, value)
      })
    }

    console.log(`🗺️ Choropleth data: ${Object.keys(values).length} regions (ITL codes)`)
    return { min, max, values }

  } catch (error) {
    console.error("💥 fetchChoropleth failed:", error)
    // Return empty choropleth data on error
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

/**
 * Test Supabase connection and show available data
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log("🧪 Testing Supabase connection to itl1_latest_all...")
    
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("*")
      .limit(100)

    if (error) {
      console.error("❌ Supabase connection failed:", error)
      return false
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ Table is empty or inaccessible")
      return false
    }

    console.log("✅ Supabase connection successful!")
    console.log(`📊 Found ${data.length} sample rows`)
    
    // Analyze available data
    const metrics = [...new Set(data.map(row => row.metric_id))].filter(Boolean)
    const regions = [...new Set(data.map(row => row.region_code))].filter(Boolean)
    const dataTypes = [...new Set(data.map(row => row.data_type))].filter(Boolean)
    const years = [...new Set(data.map(row => row.period))].filter(Boolean).sort((a, b) => a - b)
    
    console.log("\n📈 Available Data Summary:")
    console.log("=========================")
    console.log("Metrics (exact values):", metrics)
    console.log("Regions (E-codes):", regions)
    console.log("Data Types:", dataTypes)
    console.log("Year Range:", years.length > 0 ? `${years[0]} - ${years[years.length - 1]}` : "No years found")
    
    // Show ITL mapping
    console.log("\n🗺️ Region Code Mapping:")
    console.log("========================")
    regions.forEach(eCode => {
      const itlCode = getUIRegionCode(eCode)
      if (itlCode !== eCode) {
        console.log(`${eCode} → ${itlCode}`)
      }
    })
    
    // Show sample row structure
    console.log("\n🔍 Sample Row Structure:")
    console.log("========================")
    const sampleRow = data[0]
    Object.entries(sampleRow).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        console.log(`${key}: ${typeof value} = ${value}`)
      }
    })
    
    // Check for data completeness
    const historicalRows = data.filter(row => row.data_type === "historical")
    const forecastRows = data.filter(row => row.data_type === "forecast")
    
    console.log("\n📊 Data Breakdown:")
    console.log("==================")
    console.log(`Historical rows: ${historicalRows.length}`)
    console.log(`Forecast rows: ${forecastRows.length}`)
    
    // Check scenario columns
    const forecastWithCI = forecastRows.filter(row => 
      row.ci_lower !== null && row.ci_upper !== null
    )
    console.log(`Forecast rows with confidence intervals: ${forecastWithCI.length}`)
    
    // Validate metric IDs match config
    const expectedMetrics = ["population_total", "nominal_gva_mn_gbp", "gdhi_per_head_gbp", "emp_total_jobs"]
    const missingMetrics = expectedMetrics.filter(m => !metrics.includes(m))
    if (missingMetrics.length > 0) {
      console.warn("⚠️ Missing expected metrics:", missingMetrics)
    } else {
      console.log("✅ All expected metrics found!")
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
export async function getAvailableMetrics(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("metric_id")
      .limit(1000)

    if (error) throw error
    
    const metrics = [...new Set(data?.map(row => row.metric_id) || [])].filter(Boolean)
    console.log("📊 Available metrics in database:", metrics)
    return metrics
    
  } catch (error) {
    console.error("Failed to get available metrics:", error)
    return []
  }
}

/**
 * Get available regions from the database (returns ITL codes for UI)
 */
export async function getAvailableRegions(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("itl1_latest_all")
      .select("region_code, region_name")
      .limit(1000)

    if (error) throw error
    
    // Get E-codes from database
    const eCodes = [...new Set(data?.map(row => row.region_code) || [])].filter(Boolean)
    
    // Convert to ITL codes for UI
    const itlCodes = eCodes.map(eCode => getUIRegionCode(eCode))
    
    console.log("🏴󠁧󠁢󠁳󠁣󠁴󠁿 Available regions:")
    console.log("E-codes in database:", eCodes)
    console.log("ITL codes for UI:", itlCodes)
    
    // Also log region names for reference
    const regionMap = new Map()
    data?.forEach(row => {
      if (row.region_code && row.region_name) {
        const itlCode = getUIRegionCode(row.region_code)
        regionMap.set(itlCode, row.region_name)
      }
    })
    
    console.log("ITL code to name mapping:")
    regionMap.forEach((name, code) => {
      console.log(`  ${code}: ${name}`)
    })
    
    return itlCodes  // Return ITL codes for UI
    
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
  
  try {
    const { data, error } = await supabase
      .from("itl1_latest_all")
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
      console.warn(`No data for metric="${metricId}", region="${regionCode}" (${dbRegionCode})`)
    }
    
    return exists
  } catch (error) {
    console.error("Failed to verify data:", error)
    return false
  }
}

// Utility functions
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
    return `£${value.toLocaleString()}M`
  }

  // For people/jobs
  if (unit === "people" || unit === "jobs") {
    if (absValue >= 1e9) {
      return `${(value / 1e9).toFixed(decimals)}B ${unit}`
    } else if (absValue >= 1e6) {
      return `${(value / 1e6).toFixed(decimals)}M ${unit}`
    } else if (absValue >= 1e3) {
      return `${(value / 1e3).toFixed(decimals)}K ${unit}`
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