import type { Scenario } from "@/lib/metrics.config"
import { METRICS, REGIONS, getDbRegionCode, getTableName } from "@/lib/metrics.config"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"

type SupabaseLike = {
  from: (table: string) => any
}

export async function fetchCompareSeries(params: {
  supabase: SupabaseLike
  metricId: string
  regionCode: string
  scenario: Scenario
}) {
  const { supabase, metricId, regionCode, scenario } = params
  const tableName = getTableName(regionCode)
  const dbRegionCode = getDbRegionCode(regionCode)

  const { data, error } = await supabase
    .from(tableName)
    .select("period, value, ci_lower, ci_upper, data_type, data_quality")
    .eq("metric_id", metricId)
    .eq("region_code", dbRegionCode)
    .order("period", { ascending: true })

  if (error) throw new Error(error.message || "Supabase query failed")

  return (data ?? []).map((r: any) => {
    const dt = r.data_type as "historical" | "forecast"
    const dq = r.data_quality ?? null
    const year = Number(r.period)
    const base = r.value == null ? null : Number(r.value)
    const up = r.ci_upper == null ? null : Number(r.ci_upper)
    const down = r.ci_lower == null ? null : Number(r.ci_lower)

    let selected: number | null = null
    if (dt === "historical") selected = base
    else if (scenario === "baseline") selected = base
    else if (scenario === "upside") selected = up ?? base
    else if (scenario === "downside") selected = down ?? base

    return { year, value: selected, data_type: dt, data_quality: dq }
  })
}

export function buildCanonicalCompareRows(params: {
  metricId: string
  regionCode: string
  scenario: Scenario
  points: Array<{ year: number; value: number | null; data_type: string; data_quality: string | null }>
}) {
  const { metricId, regionCode, scenario, points } = params
  const metricLabel = METRICS.find((m) => m.id === metricId)?.title ?? metricId
  const unit = METRICS.find((m) => m.id === metricId)?.unit ?? ""
  const regionLabel = REGIONS.find((r) => r.code === regionCode)?.name ?? regionCode

  return points.map((p) => ({
    Metric: metricLabel,
    Region: regionLabel,
    "Region Code": regionCode,
    Year: p.year,
    Scenario: scenarioLabel(scenario),
    Value: p.value,
    Units: unit,
    "Data Type": dataTypeLabel(p.data_type),
    Source: sourceLabel({ dataType: p.data_type, dataQuality: p.data_quality }),
  }))
}

export function buildRegionYearMatrix(params: { canonicalRows: Record<string, any>[] }) {
  const { canonicalRows } = params
  const years = Array.from(
    new Set(canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number")),
  ).sort((a: number, b: number) => a - b) as number[]
  const yearCols = years.map(String)
  const header = ["Region \\ Year", ...yearCols]

  const regions = Array.from(new Set(canonicalRows.map((r) => String(r.Region)))).sort((a, b) =>
    a.localeCompare(b),
  )

  const rows = regions.map((region) => {
    const row: Record<string, any> = { "Region \\ Year": region }
    for (const y of years) row[String(y)] = null
    for (const r of canonicalRows) {
      if (String(r.Region) !== region) continue
      row[String(r.Year)] = r.Value ?? null
    }
    return row
  })

  return { header, rows }
}




