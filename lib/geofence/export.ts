/**
 * Catchment Export Utilities
 * 
 * Export catchment analysis results to CSV and Excel formats.
 */

import type { GeofenceResult, LADContribution, Geofence } from "./types"
import { downloadBlob, isoDateStamp } from "@/lib/export/download"

interface ExportOptions {
  result: GeofenceResult
  geofence?: Geofence | null
}

/**
 * Format number with appropriate suffix (K/M/B)
 */
function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

/**
 * Format currency
 */
function formatCurrency(n: number): string {
  if (n >= 1e9) return `£${(n / 1e9).toFixed(2)}bn`
  if (n >= 1e6) return `£${(n / 1e6).toFixed(1)}m`
  return `£${n.toLocaleString()}`
}

/**
 * Build summary rows for export
 */
function buildSummaryRows(options: ExportOptions): Record<string, string | number>[] {
  const { result, geofence } = options
  
  const catchmentType = geofence?.mode === "circle" 
    ? `Circle (${geofence.radiusKm ?? 10}km radius)`
    : geofence?.mode === "polygon"
      ? "Custom Polygon"
      : "Unknown"
  
  return [
    { Item: "Catchment Type", Value: catchmentType },
    { Item: "Year", Value: result.year },
    { Item: "Scenario", Value: result.scenario },
    { Item: "Total Population", Value: Math.round(result.population) },
    { Item: "Total GDHI (£)", Value: Math.round(result.gdhi_total) },
    { Item: "Total Employment", Value: Math.round(result.employment) },
    { Item: "LADs Included", Value: result.regions_used },
    { Item: "Export Date", Value: new Date().toISOString().slice(0, 10) },
  ]
}

/**
 * Build breakdown rows for export
 */
function buildBreakdownRows(result: GeofenceResult): Record<string, string | number>[] {
  return result.breakdown.map((lad) => ({
    "LAD Code": lad.code,
    "LAD Name": lad.name,
    "Weight (%)": Math.round(lad.weight * 1000) / 10,
    "Intersection (km²)": Math.round(lad.intersectionAreaKm2 * 10) / 10,
    "LAD Area (km²)": Math.round(lad.ladAreaKm2 * 10) / 10,
    "Population": Math.round(lad.population),
    "GDHI (£)": Math.round(lad.gdhi),
    "Employment": Math.round(lad.employment),
  }))
}

/**
 * Export catchment results to CSV
 */
export function exportCatchmentCSV(options: ExportOptions): void {
  const { result } = options
  const summaryRows = buildSummaryRows(options)
  const breakdownRows = buildBreakdownRows(result)
  
  // Build CSV content
  let csv = "=== CATCHMENT ANALYSIS SUMMARY ===\n"
  csv += "Item,Value\n"
  summaryRows.forEach((row) => {
    csv += `"${row.Item}","${row.Value}"\n`
  })
  
  csv += "\n=== LAD BREAKDOWN ===\n"
  if (breakdownRows.length > 0) {
    const headers = Object.keys(breakdownRows[0])
    csv += headers.map(h => `"${h}"`).join(",") + "\n"
    breakdownRows.forEach((row) => {
      csv += headers.map(h => `"${row[h]}"`).join(",") + "\n"
    })
  }
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const filename = `regioniq_catchment_analysis_${result.year}_${result.scenario}_${isoDateStamp()}.csv`
  downloadBlob(blob, filename)
}

/**
 * Export catchment results to Excel (via server-side API)
 */
export async function exportCatchmentXLSX(options: ExportOptions): Promise<void> {
  const { result, geofence } = options
  
  const res = await fetch("/api/export/xlsx/catchment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      result,
      geofence: geofence ? {
        mode: geofence.mode,
        radiusKm: geofence.radiusKm,
        center: geofence.center,
      } : null,
    }),
  })
  
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "Excel export failed")
  }
  
  const blob = await res.blob()
  const filename = `regioniq_catchment_analysis_${result.year}_${result.scenario}_${isoDateStamp()}.xlsx`
  downloadBlob(blob, filename)
}

