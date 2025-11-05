"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Download, Plus, X } from "lucide-react"
import { YEARS, type Scenario, METRICS } from "@/lib/metrics.config"

// ---------- Types ----------
type Itl1Row = {
  region_code: string
  region_name: string | null
  region_level: string | null
  metric_id: string
  period: number
  value: number | null
  unit: string | null
  freq: string | null
  data_type: string | null
  ci_lower: number | null
  ci_upper: number | null
  vintage: string | null
  forecast_run_date: string | null
  forecast_version: string | null
  is_calculated: boolean
}

type RegionOption = {
  region_code: string
  region_name: string
  short_code: string
}

interface DataTabProps {
  metricId: "emp_total_jobs" | "gdhi_per_head_gbp" | "nominal_gva_mn_gbp" | "population_total"
  region: string
  scenario: Scenario
  title?: string
  className?: string
}

// ---------- Supabase client (browser) ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

// ---------- Helpers ----------
function valueForScenario(row: Itl1Row, scenario: Scenario): number | null {
  if (scenario === "upside") return row.ci_upper
  if (scenario === "downside") return row.ci_lower
  return row.value
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: any) => {
    const s = v ?? ""
    const needsQuotes = /[",\n]/.test(String(s))
    const cleaned = String(s).replace(/"/g, '""')
    return needsQuotes ? `"${cleaned}"` : cleaned
  }
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ]
  return lines.join("\n")
}

function formatDisplay(raw: number | null, unit: string): string {
  if (raw == null) return "—"
  const num = Math.round(raw)
  let formatted = num.toLocaleString() // Add commas for display
  
  // Check if this is a monetary value (contains gbp or £)
  if (unit && (unit.toLowerCase().includes('gbp') || unit.includes('£'))) {
    // Just add £ prefix, don't add any suffix
    formatted = `£${formatted}`
  } else if (unit && !unit.includes('£')) {
    // Only append non-monetary units
    formatted += ` ${unit}`
  }
  
  return formatted
}

function formatCsv(raw: number | null): string {
  if (raw == null) return ""
  return Math.round(raw).toString() // Full number, no commas for CSV
}

const itl1ShortCodes: Record<string, string> = {
  'E12000001': 'UKC',
  'E12000002': 'UKD',
  'E12000003': 'UKE',
  'E12000004': 'UKF',
  'E12000005': 'UKG',
  'E12000006': 'UKH',
  'E12000007': 'UKI',
  'E12000008': 'UKJ',
  'E12000009': 'UKK',
  'W92000004': 'UKL',
  'S92000003': 'UKM',
  'N92000002': 'UKN',
}

export function MetricDataTab({
  metricId,
  region,
  scenario,
  title,
  className,
}: DataTabProps) {
  const [selectedRegions, setSelectedRegions] = useState<string[]>([region])
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([])
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<Itl1Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unit from metric config (fallback to first row)
  const metricCfg = METRICS.find((m) => m.id === metricId)
  const metricUnit = metricCfg?.unit || (rows[0]?.unit || "")

  // ---------- Load region list (for search/add) ----------
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from("itl1_latest_all")
        .select("region_code, region_name")
        .eq("metric_id", metricId)
        .eq("region_level", "ITL1")
        .order("region_name", { ascending: true })

      if (!active) return
      if (error) {
        console.error("Region list error:", error)
        setError("Failed to load regions")
        return
      }
      const dedup = Array.from(
        new Map((data ?? []).map((r) => [r.region_code, r as any])).values()
      ) as { region_code: string; region_name: string }[]
      setRegionOptions(
        dedup
          .filter((r) => r.region_code && r.region_name)
          .map((r) => ({ 
            region_code: r.region_code, 
            region_name: r.region_name!, 
            short_code: itl1ShortCodes[r.region_code] || r.region_code 
          }))
      )
    })()
    return () => {
      active = false
    }
  }, [metricId])

  // ---------- Load data for selected regions ----------
  useEffect(() => {
    let active = true
    if (!selectedRegions.length) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)

    ;(async () => {
      const { data, error } = await supabase
        .from("itl1_latest_all")
        .select(
          "region_code, region_name, region_level, metric_id, period, value, unit, freq, data_type, ci_lower, ci_upper, vintage, forecast_run_date, forecast_version, is_calculated"
        )
        .eq("metric_id", metricId)
        .in("region_code", selectedRegions)
        .gte("period", YEARS.min)
        .lte("period", YEARS.max)
        .order("region_code", { ascending: true })
        .order("period", { ascending: true })

      if (!active) return
      if (error) {
        console.error("Data fetch error:", error)
        setError("Failed to load data")
      } else {
        setRows((data ?? []) as Itl1Row[])
      }
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [metricId, selectedRegions])

  // ---------- Pivot to wide table ----------
  const { pivotRows, yearColumns, unitForDisplay } = useMemo(() => {
    const years = Array.from(
      new Set(rows.map((r) => r.period))
    ).sort((a, b) => a - b)

    // Build per-region map
    const byRegion = new Map<string, { code: string; name: string; values: Record<number, number | null> }>()
    rows.forEach((r) => {
      const key = r.region_code
      if (!byRegion.has(key)) {
        byRegion.set(key, {
          code: r.region_code,
          name: r.region_name || r.region_code,
          values: {},
        })
      }
      const v = valueForScenario(r, scenario)
      byRegion.get(key)!.values[r.period] = v ?? null
    })

    const wide = Array.from(byRegion.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({
        Region: r.name,
        ...Object.fromEntries(
          years.map((y) => [y, r.values[y] ?? null])
        ),
      }))

    const unit = metricUnit || rows.find((r) => r.unit)?.unit || ""

    return {
      pivotRows: wide,
      yearColumns: years,
      unitForDisplay: unit,
    }
  }, [rows, scenario, metricUnit])

  // ---------- Add / remove regions ----------
  const addRegion = (code: string) => {
    if (!code) return
    if (selectedRegions.includes(code)) return
    setSelectedRegions((prev) => [...prev, code])
    setQuery("")
  }

  const removeRegion = (code: string) => {
    setSelectedRegions((prev) => prev.filter((c) => c !== code))
  }

  // ---------- Export CSV ----------
  const handleExport = () => {
    // Build CSV table with Region and Unit as columns A and B
    const csvRows = pivotRows.map((r) => {
      // Start with Region in column A and Unit in column B
      const obj: Record<string, string | number> = { 
        Region: r.Region as string,
        Unit: unitForDisplay || ""
      }
      // Add year columns starting from column C
      yearColumns.forEach((y) => {
        const raw = (r as any)[y] as number | null
        obj[String(y)] = formatCsv(raw) // Use raw integer format
      })
      return obj
    })
    
    const csv = toCsv(csvRows)
    const filename = `${metricId}_${scenario}_${new Date().toISOString().slice(0, 10)}.csv`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
  }

  // ---------- Render ----------
  const metricLabel =
    title ??
    METRICS.find((m) => m.id === metricId)?.label ??
    metricId.replaceAll("_", " ")

  const scenarioLabel =
    scenario === "baseline" ? "Baseline" : scenario === "upside" ? "Upside" : "Downside"

  const selectedRegionChips = selectedRegions
    .map((code) => {
      const region = regionOptions.find((r) => r.region_code === code)
      return { code, name: region?.region_name || code, short_code: region?.short_code || code }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const filteredOptions = regionOptions.filter(
    (opt) =>
      (opt.region_name || "").toLowerCase().includes(query.toLowerCase()) ||
      (opt.region_code || "").toLowerCase().includes(query.toLowerCase()) ||
      (opt.short_code || "").toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{metricLabel} — Data</CardTitle>
        <CardDescription>
          {scenarioLabel} scenario • {YEARS.min}–{YEARS.max}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add region… (type to search)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const first = filteredOptions[0]
                  if (first) addRegion(first.region_code)
                }}
                disabled={!filteredOptions.length}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Suggestion list */}
            {query && (
              <div className="mt-2 max-h-48 overflow-auto rounded border bg-background text-sm">
                {filteredOptions.length ? (
                  filteredOptions.map((o) => (
                    <button
                      key={o.region_code}
                      className="w-full text-left px-3 py-2 hover:bg-muted"
                      onClick={() => addRegion(o.region_code)}
                    >
                      <span className="font-medium">{o.region_name}</span>{" "}
                      <span className="text-muted-foreground">({o.short_code})</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-muted-foreground">No matches</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {pivotRows.length} region{pivotRows.length === 1 ? "" : "s"}
            </Badge>
            {unitForDisplay && (
              <Badge variant="outline" className="text-xs">
                Unit: {unitForDisplay}
              </Badge>
            )}
            <Button type="button" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Selected region chips */}
        <div className="flex flex-wrap gap-2">
          {selectedRegionChips.map((r) => (
            <span
              key={r.code}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
            >
              {r.name} ({r.short_code})
              <button
                className="hover:text-destructive"
                onClick={() => removeRegion(r.code)}
                aria-label={`Remove ${r.name}`}
                title={`Remove ${r.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 bg-background">
                <th className="text-left border-b px-3 py-2 sticky left-0 bg-background z-[1]">Region</th>
                {yearColumns.map((y) => (
                  <th key={y} className="text-right border-b px-3 py-2 whitespace-nowrap">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={yearColumns.length + 1}>
                    Loading data…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-3 py-4 text-destructive" colSpan={yearColumns.length + 1}>
                    {error}
                  </td>
                </tr>
              ) : pivotRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={yearColumns.length + 1}>
                    No data for selection
                  </td>
                </tr>
              ) : (
                pivotRows.map((r) => (
                  <tr key={r.Region as string} className="hover:bg-muted/30">
                    <td className="px-3 py-2 border-b sticky left-0 bg-background z-[1] font-medium">
                      {r.Region as string}
                    </td>
                    {yearColumns.map((y) => {
                      const raw = (r as any)[y] as number | null
                      return (
                        <td key={y} className="text-right px-3 py-2 border-b whitespace-nowrap">
                          {formatDisplay(raw, unitForDisplay)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}