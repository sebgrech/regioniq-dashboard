import type { DataPoint } from "@/lib/data-service"
import type { Scenario } from "@/lib/metrics.config"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"

type AnyRecord = Record<string, any>

type AdditionalSeries = {
  scenario: Scenario
  data: DataPoint[]
}

function buildTimeseriesYearMap(params: {
  baseline: DataPoint[]
  additionalSeries?: AdditionalSeries[]
}) {
  const { baseline, additionalSeries = [] } = params

  const byYear = new Map<number, AnyRecord>()

  const getYear = (pt: any) => (pt?.year ?? pt?.period) as number
  const getType = (pt: any) => (pt?.type ?? pt?.data_type) as string | undefined

  for (const pt of baseline ?? []) {
    const year = getYear(pt)
    if (year == null) continue

    const row = byYear.get(year) ?? { year }
    row.type ??= getType(pt)
    if (pt?.data_quality != null && row.data_quality == null) row.data_quality = pt.data_quality

    if (pt?.value != null) row.baseline = Number(pt.value)
    if (pt?.ci_upper != null) row.upside = Number(pt.ci_upper)
    if (pt?.ci_lower != null) row.downside = Number(pt.ci_lower)

    byYear.set(year, row)
  }

  for (const s of additionalSeries) {
    const key = s.scenario
    for (const pt of s.data ?? []) {
      const year = getYear(pt)
      if (year == null) continue

      const row = byYear.get(year) ?? { year }
      row.type ??= getType(pt)
      if (pt?.data_quality != null && row.data_quality == null) row.data_quality = pt.data_quality

      const v = pt?.value ?? pt?.val ?? pt?.y
      if (v != null) row[key] = Number(v)
      byYear.set(year, row)
    }
  }

  return byYear
}

/**
 * Convert a Recharts-style timeseries input into a tidy/long export format:
 * one row per (year, seriesName).
 *
 * - Baseline values come from `baseline[].value`
 * - If baseline points include `ci_upper` / `ci_lower`, those become `upside` / `downside`
 * - Additional series are exported as their scenario name (e.g. `upside`, `downside`)
 */
export function timeseriesToLongRows(params: {
  baseline: DataPoint[]
  additionalSeries?: AdditionalSeries[]
  unit?: string
  meta?: AnyRecord
  /** If the chart is a single-scenario view, map baseline values into that scenario. */
  primaryScenario?: Scenario
}): AnyRecord[] {
  const { baseline, additionalSeries = [], unit, meta = {}, primaryScenario } = params

  const byYear = buildTimeseriesYearMap({ baseline, additionalSeries })

  const years = Array.from(byYear.keys()).sort((a, b) => a - b)
  const out: AnyRecord[] = []

  for (const y of years) {
    const r = byYear.get(y)!
    for (const seriesName of ["baseline", "upside", "downside"] as const) {
      const v = r[seriesName]
      if (v == null) continue

      const scen =
        seriesName === "baseline" && primaryScenario && primaryScenario !== "baseline"
          ? primaryScenario
          : (seriesName as any)

      out.push({
        ...meta,
        Year: y,
        Scenario: scenarioLabel(scen),
        Value: v,
        Units: unit,
        "Data Type": dataTypeLabel(r.type),
        Source: sourceLabel({ dataType: r.type, dataQuality: r.data_quality }),
      })
    }
  }

  return out
}

/**
 * Convert a timeseries into an Excel-friendly wide format:
 * Year | Baseline | Upside | Downside
 *
 * This is intended as a second sheet for XLSX exports to reduce cognitive load
 * for spreadsheet users (no repeated meta columns).
 */
export function timeseriesToWideRows(params: {
  baseline: DataPoint[]
  additionalSeries?: AdditionalSeries[]
  /** If the chart is a single-scenario view, map baseline values into that scenario column. */
  primaryScenario?: Scenario
}): { Year: number; Baseline?: number | null; Upside?: number | null; Downside?: number | null }[] {
  const { baseline, additionalSeries = [], primaryScenario } = params
  const byYear = buildTimeseriesYearMap({ baseline, additionalSeries })
  const years = Array.from(byYear.keys()).sort((a, b) => a - b)

  return years.map((y) => {
    const r = byYear.get(y) ?? {}
    const base = r.baseline ?? null
    const up = r.upside ?? null
    const down = r.downside ?? null

    // If this is a single-scenario chart (e.g. Upside), move baseline values into that column.
    if (primaryScenario && primaryScenario !== "baseline") {
      if (primaryScenario === "upside") {
        return { Year: y, Baseline: null, Upside: base, Downside: null }
      }
      if (primaryScenario === "downside") {
        return { Year: y, Baseline: null, Upside: null, Downside: base }
      }
    }

    return {
      Year: y,
      Baseline: base,
      Upside: up,
      Downside: down,
    }
  })
}

/**
 * OE-native working view:
 * Scenario \\ Year | 1991 | 1992 | ... | 2050
 * Baseline         | ...  | ...  | ... | ...
 * Upside           | ...  | ...  | ... | ...
 * Downside         | ...  | ...  | ... | ...
 */
export function timeseriesToScenarioYearRows(params: {
  baseline: DataPoint[]
  additionalSeries?: AdditionalSeries[]
  primaryScenario?: Scenario
}): Record<string, any>[] {
  const { baseline, additionalSeries = [], primaryScenario } = params
  const byYear = buildTimeseriesYearMap({ baseline, additionalSeries })
  const years = Array.from(byYear.keys()).sort((a, b) => a - b)

  const yearKeys = years.map(String)

  const rows: Record<string, any>[] = []
  const scenarios: Array<{ label: string; key: "baseline" | "upside" | "downside" }> = [
    { label: "Baseline", key: "baseline" },
    { label: "Upside", key: "upside" },
    { label: "Downside", key: "downside" },
  ]

  // If this is a single-scenario chart (e.g. Upside), map baseline values into that scenario row.
  const mapBaselineTo: "baseline" | "upside" | "downside" | null =
    primaryScenario && primaryScenario !== "baseline" ? (primaryScenario as any) : null

  for (const s of scenarios) {
    const row: Record<string, any> = { "Scenario \\ Year": s.label }
    for (const y of years) {
      const r = byYear.get(y) ?? {}
      let v: number | null = null

      if (mapBaselineTo) {
        v = s.key === mapBaselineTo ? (r.baseline ?? null) : null
      } else {
        v = (r as any)[s.key] ?? null
      }

      row[String(y)] = v
    }
    rows.push(row)
  }

  // Ensure header order starts with Scenario \\ Year then years (exportXlsx will respect provided header if set).
  // json_to_sheet will infer columns from keys; having all year keys present on every row keeps order stable.
  for (const r of rows) {
    for (const k of yearKeys) {
      if (!(k in r)) r[k] = null
    }
  }

  return rows
}


