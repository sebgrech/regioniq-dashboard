"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { testSupabaseConnection, fetchSeries } from "@/lib/data-service"

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
      // Test with some common values - adjust these based on what you see in console
      const data = await fetchSeries({
        metricId: "gva", // or whatever metric_id you have
        region: "UKI", // or whatever region_code you have
        scenario: "baseline" // or whatever data_type you have
      })
      
      setTestData(data)
      console.log("📊 Fetched test data:", data)
    } catch (error) {
      console.error("Test fetch failed:", error)
      setTestData([])
    }
    
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🧪 Supabase Connection Test</h1>
      
      <div className="space-y-4">
        <div className="flex gap-4">
          <Button onClick={testConnection} disabled={loading}>
            {loading ? "Testing..." : "Test Connection"}
          </Button>
          
          <Button onClick={testDataFetch} disabled={loading}>
            {loading ? "Fetching..." : "Test Data Fetch"}
          </Button>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p><strong>Connection Status:</strong> {connectionStatus}</p>
        </div>

        {testData.length > 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="font-semibold mb-2">✅ Sample Data Retrieved:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(testData.slice(0, 5), null, 2)}
            </pre>
            <p className="mt-2 text-sm text-gray-600">
              Total records: {testData.length}
            </p>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600">
        <p><strong>Instructions:</strong></p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Test Connection" first to verify Supabase works</li>
          <li>Check the browser console for available metrics/regions</li>
          <li>Click "Test Data Fetch" to try fetching actual data</li>
          <li>Once this works, your main dashboard should work too! 🎉</li>
        </ol>
      </div>
    </div>
  )
}