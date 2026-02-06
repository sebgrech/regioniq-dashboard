/**
 * Catchment Export Utilities
 * 
 * Export catchment analysis results to CSV and Excel formats.
 * Supports both LAD and MSOA boundary levels.
 */

import type { GeofenceResult, RegionContribution, Geofence } from "./types"
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
  if (n >= 1e9) return `\u00A3${(n / 1e9).toFixed(2)}bn`
  if (n >= 1e6) return `\u00A3${(n / 1e6).toFixed(1)}m`
  return `\u00A3${n.toLocaleString()}`
}

/**
 * Build summary rows for export
 */
function buildSummaryRows(options: ExportOptions): Record<string, string | number>[] {
  const { result, geofence } = options
  const isMSOA = result.level === "MSOA"
  
  const catchmentType = geofence?.mode === "circle" 
    ? `Circle (${geofence.radiusKm ?? 10}km radius)`
    : geofence?.mode === "polygon"
      ? "Custom Polygon"
      : "Unknown"

  const regionsLabel = isMSOA ? "Neighbourhoods Included" : "LADs Included"
  
  const rows: Record<string, string | number>[] = [
    { Item: "Catchment Type", Value: catchmentType },
    { Item: "Granularity", Value: isMSOA ? "MSOA (Neighbourhood)" : "LAD (District)" },
    { Item: "Year", Value: result.year },
    { Item: "Scenario", Value: result.scenario },
    { Item: "Total Population", Value: Math.round(result.population) },
  ]

  if (isMSOA) {
    rows.push(
      { Item: "Avg Household Income (\u00A3)", Value: Math.round(result.average_income) },
      { Item: "Total GVA (\u00A3M)", Value: result.gva },
    )
  } else {
    rows.push(
      { Item: "Total GDHI (\u00A3)", Value: Math.round(result.gdhi_total) },
    )
  }

  rows.push(
    { Item: "Total Employment", Value: Math.round(result.employment) },
    { Item: regionsLabel, Value: result.regions_used },
    { Item: "Export Date", Value: new Date().toISOString().slice(0, 10) },
  )

  return rows
}

/**
 * Build breakdown rows for export
 */
function buildBreakdownRows(result: GeofenceResult): Record<string, string | number>[] {
  const isMSOA = result.level === "MSOA"

  return result.breakdown.map((region) => {
    const base: Record<string, string | number> = {
      "Area Code": region.code,
      "Area Name": region.name,
      "Weight (%)": Math.round(region.weight * 1000) / 10,
      "Intersection (km\u00B2)": Math.round(region.intersectionAreaKm2 * 10) / 10,
      "Area (km\u00B2)": Math.round(region.regionAreaKm2 * 10) / 10,
      "Population": Math.round(region.population),
    }

    if (isMSOA) {
      base["Income (\u00A3)"] = Math.round(region.income)
      base["GVA (\u00A3M)"] = Math.round(region.gva * 100) / 100
    } else {
      base["GDHI (\u00A3)"] = Math.round(region.gdhi)
    }

    base["Employment"] = Math.round(region.employment)
    return base
  })
}

/**
 * Export catchment results to CSV
 */
export function exportCatchmentCSV(options: ExportOptions): void {
  const { result } = options
  const summaryRows = buildSummaryRows(options)
  const breakdownRows = buildBreakdownRows(result)
  
  const sectionLabel = result.level === "MSOA"
    ? "NEIGHBOURHOOD BREAKDOWN"
    : "AREA BREAKDOWN"

  // Build CSV content
  let csv = "=== CATCHMENT ANALYSIS SUMMARY ===\n"
  csv += "Item,Value\n"
  summaryRows.forEach((row) => {
    csv += `"${row.Item}","${row.Value}"\n`
  })
  
  csv += `\n=== ${sectionLabel} ===\n`
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

/**
 * Export the catchment summary metric cards as an editable PowerPoint slide (16:9).
 */
export async function exportCatchmentPPTX(options: ExportOptions & { title?: string }): Promise<void> {
  const { result, title } = options

  const res = await fetch("/api/export/pptx/catchment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, title }),
  })
  
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(msg || "PowerPoint export failed")
  }
  
  const blob = await res.blob()
  const filename = `regioniq_catchment_summary_${result.year}_${result.scenario}_${isoDateStamp()}.pptx`
  downloadBlob(blob, filename)
}
