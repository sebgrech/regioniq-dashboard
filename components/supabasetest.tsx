"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { testSupabaseConnection, fetchSeries } from "@/lib/data-service"
import { supabase } from "@/lib/supabase"

export function SupabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState<string>("Not tested")
  const [testData, setTestData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setConnectionStatus("Testing...")
    
    try {
      const success = await testSupabaseConnection()
      setConnectionStatus(success ? "✅ Connected!" : "❌ Failed")
    } catch (error) {
      setConnectionStatus(`❌ Error: ${error}`)
    }
    
    setLoading(false)
  }

  const testDataFetch = async () => {
    setLoading(true)
    
    try {
      const data = await fetchSeries({
        metricId: "nominal_gva_mn_gbp",
        region: "UKI",
        scenario: "baseline"
      })
      
      setTestData(data)
      console.log("📊 Fetched test data:", data)
      
      if (data.length === 0) {
        console.warn("⚠️ No data returned - run Debug Query to see why")
      }
    } catch (error) {
      console.error("Test fetch failed:", error)
      setTestData([])
    }
    
    setLoading(false)
  }

  // Inline debug function - directly in this component
  const runInlineDebug = async () => {
    setLoading(true)
    console.log("🔍 STARTING INLINE DEBUG")
    console.log("========================")
    
    try {
      // 1. Get some sample data
      console.log("\n1️⃣ Fetching sample data...")
      const { data: samples, error: sampleError } = await supabase
        .from("itl1_latest_all")
        .select("*")
        .limit(5)
      
      if (sampleError) {
        console.error("Sample query error:", sampleError)
      } else {
        console.log("Sample data:", samples)
        if (samples && samples.length > 0) {
          console.log("First row keys:", Object.keys(samples[0]))
          console.log("First row:", samples[0])
        }
      }
      
      // 2. Get unique metrics
      console.log("\n2️⃣ Getting unique metrics...")
      const { data: metricRows } = await supabase
        .from("itl1_latest_all")
        .select("metric_id")
        .limit(200)
      
      const uniqueMetrics = [...new Set(metricRows?.map(r => r.metric_id))].filter(Boolean)
      console.log("Unique metrics found:", uniqueMetrics)
      
      // 3. Get unique regions
      console.log("\n3️⃣ Getting unique regions...")
      const { data: regionRows } = await supabase
        .from("itl1_latest_all")
        .select("region_code")
        .limit(200)
      
      const uniqueRegions = [...new Set(regionRows?.map(r => r.region_code))].filter(Boolean)
      console.log("Unique regions found:", uniqueRegions)
      
      // 4. Test specific query
      console.log("\n4️⃣ Testing specific query...")
      console.log("Looking for: metric_id='nominal_gva_mn_gbp' AND region_code='E12000007'")
      
      const { data: testQuery, error: testError } = await supabase
        .from("itl1_latest_all")
        .select("*")
        .eq("metric_id", "nominal_gva_mn_gbp")
        .eq("region_code", "E12000007")
        .limit(5)
      
      if (testError) {
        console.error("Test query error:", testError)
      } else {
        console.log(`Found ${testQuery?.length || 0} rows`)
        if (testQuery && testQuery.length > 0) {
          console.log("Test query result:", testQuery[0])
        }
      }
      
      console.log("\n✅ DEBUG COMPLETE - Check the output above")
      
    } catch (error) {
      console.error("Debug error:", error)
    }
    
    setLoading(false)
  }

  // Auto-test connection on mount
  useEffect(() => {
    testConnection()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🧪 Supabase Connection Test</h1>
      
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Button onClick={testConnection} disabled={loading}>
            {loading ? "Testing..." : "Test Connection"}
          </Button>
          
          <Button onClick={testDataFetch} disabled={loading}>
            {loading ? "Fetching..." : "Test Data Fetch"}
          </Button>
          
          <Button 
            onClick={runInlineDebug} 
            disabled={loading}
            variant="outline"
            className="bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20"
          >
            {loading ? "Debugging..." : "🔍 Run Debug (Check Console)"}
          </Button>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p><strong>Connection Status:</strong> {connectionStatus}</p>
        </div>

        {testData.length === 0 && connectionStatus.includes("✅") && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200">
              ⚠️ Connected but no data found. Click "Run Debug" and check the browser console (F12)
              to see what metric_ids and region_codes are actually in your table.
            </p>
          </div>
        )}

        {testData.length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-semibold mb-2">✅ Sample Data Retrieved:</h3>
            <pre className="text-sm overflow-auto bg-white dark:bg-gray-900 p-2 rounded">
              {JSON.stringify(testData.slice(0, 5), null, 2)}
            </pre>
            <p className="mt-2 text-sm text-gray-600">
              Total records: {testData.length} | 
              Years: {testData[0]?.year} - {testData[testData.length-1]?.year}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
        <p className="font-semibold">⚠️ Important:</p>
        <p>After clicking "Run Debug", open your browser console (F12) to see the debug output.</p>
        <p>The console will show you:</p>
        <ul className="list-disc list-inside mt-2">
          <li>Sample data from your table</li>
          <li>All unique metric_ids</li>
          <li>All unique region_codes</li>
          <li>Test query results</li>
        </ul>
      </div>
    </div>
  )
}