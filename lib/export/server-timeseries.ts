import { getDbRegionCode, getTableName, METRICS, REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"

type SupabaseLike = {
  from: (table: string) => any
}

export async function fetchTimeseriesForExport(params: {
  supabase: SupabaseLike
  metricId: string
  regionCode: string
}): Promise<
  Array<{
    year: number
    value: number | null
    ci_lower: number | null
    ci_upper: number | null
    data_type: "historical" | "forecast"
    data_quality: string | null
  }>
> {
  const { supabase, metricId, regionCode } = params
  const tableName = getTableName(regionCode)
  const dbRegionCode = getDbRegionCode(regionCode)

  const { data, error } = await supabase
    .from(tableName)
    .select("period, value, ci_lower, ci_upper, data_type, data_quality")
    .eq("metric_id", metricId)
    .eq("region_code", dbRegionCode)
    .order("period", { ascending: true })

  if (error) throw new Error(error.message || "Supabase query failed")

  return (data ?? []).map((r: any) => ({
    year: Number(r.period),
    value: r.value == null ? null : Number(r.value),
    ci_lower: r.ci_lower == null ? null : Number(r.ci_lower),
    ci_upper: r.ci_upper == null ? null : Number(r.ci_upper),
    data_type: r.data_type as "historical" | "forecast",
    data_quality: r.data_quality ?? null,
  }))
}

export function buildCanonicalRows(params: {
  metricId: string
  regionCode: string
  rows: Awaited<ReturnType<typeof fetchTimeseriesForExport>>
  scenarios?: Scenario[]
}): Record<string, any>[] {
  const { metricId, regionCode, rows, scenarios } = params

  const metricLabel = METRICS.find((m) => m.id === metricId)?.title ?? metricId
  const regionLabel = REGIONS.find((r) => r.code === regionCode)?.name ?? regionCode

  const scenarioList: Scenario[] = scenarios?.length ? scenarios : (["baseline", "upside", "downside"] as Scenario[])
  const singleScenario = scenarioList.length === 1 ? scenarioList[0] : null

  const out: Record<string, any>[] = []

  for (const r of rows) {
    const dt = r.data_type
    const dq = r.data_quality

    if (dt === "historical") {
      // Historical is baseline-only in the database, but for a single-scenario export
      // we label it as that scenario (the chart user experience expects continuity).
      const scen = singleScenario ?? "baseline"
      out.push({
        Metric: metricLabel,
        Region: regionLabel,
        "Region Code": regionCode,
        Year: r.year,
        Scenario: scenarioLabel(scen),
        Value: r.value ?? null,
        Units: METRICS.find((m) => m.id === metricId)?.unit ?? "",
        "Data Type": dataTypeLabel(dt),
        Source: sourceLabel({ dataType: dt, dataQuality: dq }),
      })
      continue
    }

    // Forecast: include requested scenarios (pull from value/CI fields).
    for (const s of scenarioList) {
      let v: number | null = null
      if (s === "baseline") v = r.value ?? null
      if (s === "upside") v = r.ci_upper ?? r.value ?? null
      if (s === "downside") v = r.ci_lower ?? r.value ?? null

      out.push({
        Metric: metricLabel,
        Region: regionLabel,
        "Region Code": regionCode,
        Year: r.year,
        Scenario: scenarioLabel(s),
        Value: v,
        Units: METRICS.find((m) => m.id === metricId)?.unit ?? "",
        "Data Type": dataTypeLabel(dt),
        Source: sourceLabel({ dataType: dt, dataQuality: dq }),
      })
    }
  }

  return out
}

export function buildScenarioYearMatrix(params: {
  canonicalRows: Record<string, any>[]
  scenarios?: string[]
}): { header: string[]; rows: Record<string, any>[] } {
  const { canonicalRows, scenarios } = params
  const years = Array.from(
    new Set(canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number")),
  ).sort((a: number, b: number) => a - b) as number[]

  const yearCols = years.map(String)
  const header = ["Scenario \\ Year", ...yearCols]

  const defaultOrder = ["Baseline", "Upside", "Downside"]
  const scenOrder = scenarios?.length ? scenarios : defaultOrder
  const matrix: Record<string, any>[] = []

  for (const scen of scenOrder) {
    const row: Record<string, any> = { "Scenario \\ Year": scen }
    for (const y of years) row[String(y)] = null
    for (const r of canonicalRows) {
      if (r.Scenario !== scen) continue
      const y = r.Year
      if (typeof y !== "number") continue
      row[String(y)] = r.Value ?? null
    }
    matrix.push(row)
  }

  return { header, rows: matrix }
}

export function computeInfo(params: {
  canonicalRows: Record<string, any>[]
  metricLabel: string
  regionLabel: string
  regionCode: string
  units: string
}): {
  coverage: string
  scenarios: string
  sources: string
  generated: string
} {
  const { canonicalRows } = params
  const years = canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number") as number[]
  const minYear = years.length ? Math.min(...years) : null
  const maxYear = years.length ? Math.max(...years) : null

  const scenSet = new Set<string>()
  const srcSet = new Set<string>()
  let hasForecast = false
  let hasHistorical = false
  for (const r of canonicalRows) {
    if (r.Scenario) scenSet.add(String(r.Scenario))
    if (r.Source) srcSet.add(String(r.Source))
    if (String(r["Data Type"]).toLowerCase() === "forecast") hasForecast = true
    if (String(r["Data Type"]).toLowerCase() === "historical") hasHistorical = true
  }

  // Prefer institutional phrasing on Info sheet.
  const sources = Array.from(srcSet)
  const sourcesLabel = (() => {
    // Common case: ONS + RegionIQ
    const hasONS = sources.includes("ONS")
    const hasRIQ = sources.includes("RegionIQ")
    const parts: string[] = []
    if (hasONS && hasHistorical) parts.push("ONS (historical)")
    if (hasRIQ && hasForecast) parts.push("RegionIQ (forecast)")
    const remaining = sources.filter((s) => s !== "ONS" && s !== "RegionIQ")
    remaining.forEach((s) => parts.push(s))
    return parts.join("; ")
  })()

  return {
    coverage: minYear && maxYear ? `${minYear}–${maxYear}` : "",
    scenarios: Array.from(scenSet).join(", "),
    sources: sourcesLabel,
    generated: new Date().toISOString(),
  }
}

export function normalizeUnits(u: string) {
  if (!u) return ""
  if (u === "people") return "People"
  if (u === "jobs") return "Jobs"
  return u.charAt(0).toUpperCase() + u.slice(1)
}


