import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/api/require-user"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"

type Selection =
  | { filter: "item"; values: string[] }
  | { filter: "all" }
  | { filter: "range"; from: string; to: string }

type QueryDim = {
  code: "metric" | "region" | "level" | "year" | "scenario" | "measure" | "data_type"
  selection: Selection
}

const SelectionSchema = z.union([
  z.object({ filter: z.literal("item"), values: z.array(z.string()).min(1) }),
  z.object({ filter: z.literal("all") }),
  z.object({ filter: z.literal("range"), from: z.string(), to: z.string() }),
])

const BodySchema = z.object({
  query: z.array(
    z.object({
      code: z.enum(["metric", "region", "level", "year", "scenario", "measure", "data_type"]),
      selection: SelectionSchema,
    })
  ),
  response: z
    .object({
      format: z.enum(["records", "json-stat2"]).default("records"),
    })
    .optional(),
})

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

const TABLE_BY_LEVEL: Record<RegionLevel, string> = {
  ITL1: "itl1_latest_all",
  ITL2: "itl2_latest_all",
  ITL3: "itl3_latest_all",
  LAD: "lad_latest_all",
}

function getDim(query: QueryDim[], code: QueryDim["code"]) {
  return query.find((q) => q.code === code)?.selection
}

function selectionItems(sel: Selection | undefined): string[] | null {
  if (!sel) return null
  if (sel.filter === "all") return null
  if (sel.filter === "item") return sel.values
  return null
}

function selectionRange(sel: Selection | undefined): { from: number; to: number } | null {
  if (!sel) return null
  if (sel.filter !== "range") return null
  const from = Number(sel.from)
  const to = Number(sel.to)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return { from, to }
}

function selectionYears(sel: Selection | undefined): number[] | null {
  if (!sel) return null
  if (sel.filter !== "item") return null
  const years = (sel.values ?? []).map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[]
  return years.length ? Array.from(new Set(years)).sort((a, b) => a - b) : null
}

function normalizeScenario(values: string[] | null): Scenario[] {
  const allowed: Scenario[] = ["baseline", "upside", "downside"]
  if (!values) return ["baseline"]
  return values.filter((v): v is Scenario => allowed.includes(v as Scenario))
}

function chooseMeasureForScenario(s: Scenario, measure: "value" | "ci_lower" | "ci_upper" | null) {
  if (measure) return measure
  if (s === "upside") return "ci_upper"
  if (s === "downside") return "ci_lower"
  return "value"
}

function pickValue(row: any, measure: "value" | "ci_lower" | "ci_upper") {
  // Match existing product logic: historical always uses `value`.
  if (row.data_type === "historical") return row.value ?? null
  const v = row[measure]
  if (v == null) return row.value ?? null
  return v
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const bodyJson = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(bodyJson)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const query = parsed.data.query as QueryDim[]
  const format = parsed.data.response?.format ?? "records"
  if (format !== "records") {
    return NextResponse.json({ error: "json-stat2 not implemented in v1 (use records)" }, { status: 400 })
  }

  // Dimensions
  const metricSel = selectionItems(getDim(query, "metric"))
  const regionSel = selectionItems(getDim(query, "region"))
  const levelSel = selectionItems(getDim(query, "level")) as RegionLevel[] | null
  const yearItems = selectionYears(getDim(query, "year"))
  const yearRange = selectionRange(getDim(query, "year")) ?? { from: 2010, to: 2050 }
  const scenarioSel = normalizeScenario(selectionItems(getDim(query, "scenario")))
  const measureSelRaw = selectionItems(getDim(query, "measure"))
  const measureSel =
    measureSelRaw && measureSelRaw.length > 0
      ? (measureSelRaw[0] as "value" | "ci_lower" | "ci_upper")
      : null
  const dataTypeSel = selectionItems(getDim(query, "data_type"))

  // Guardrails (scalability + safety)
  const metricIds = metricSel ?? METRICS.map((m) => m.id)
  const metricIdsCapped = metricIds.slice(0, 50)
  const regionCodes = regionSel ?? REGIONS.map((r) => r.code)
  const regionCodesCapped = regionCodes.slice(0, 500)
  const levels = (levelSel ?? ["ITL1", "ITL2", "ITL3", "LAD"]).filter((l): l is RegionLevel =>
    ["ITL1", "ITL2", "ITL3", "LAD"].includes(l)
  )

  const byLevel = new Map<RegionLevel, string[]>()
  for (const code of regionCodesCapped) {
    const r = REGIONS.find((x) => x.code === code || x.dbCode === code)
    if (!r) continue
    const lvl = r.level as RegionLevel
    if (!levels.includes(lvl)) continue
    const dbCode = r.dbCode
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(dbCode)
  }

  // Query each level table and normalize
  const records: Array<Record<string, any>> = []

  for (const [lvl, dbCodes] of byLevel.entries()) {
    const table = TABLE_BY_LEVEL[lvl]
    if (!table) continue
    if (!dbCodes.length) continue

    const q = auth.supabase
      .from(table)
      .select(
        "region_code, region_name, region_level, metric_id, period, value, ci_lower, ci_upper, unit, freq, data_type, vintage, forecast_run_date, forecast_version, is_calculated"
      )
      .in("region_code", dbCodes)
      .in("metric_id", metricIdsCapped)
      .order("metric_id", { ascending: true })
      .order("region_code", { ascending: true })
      .order("period", { ascending: true })

    if (yearItems && yearItems.length > 0) {
      q.in("period", yearItems)
    } else {
      q.gte("period", yearRange.from).lte("period", yearRange.to)
    }

    if (dataTypeSel && dataTypeSel.length > 0) {
      q.in("data_type", dataTypeSel)
    }

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message, table }, { status: 500 })
    }

    for (const row of data ?? []) {
      for (const scenario of scenarioSel) {
        const measure = chooseMeasureForScenario(scenario, measureSel)
        records.push({
          metric: row.metric_id,
          region: REGIONS.find((x) => x.dbCode === row.region_code)?.code ?? row.region_code,
          region_db: row.region_code,
          region_name: row.region_name,
          level: lvl,
          year: row.period,
          scenario,
          measure,
          value: pickValue(row, measure),
          data_type: row.data_type,
          unit: row.unit,
          freq: row.freq,
        })
      }
    }
  }

  // Output caps
  const MAX_RECORDS = 250_000
  const out = records.slice(0, MAX_RECORDS)

  const meta = {
    dataset: "regional_observations",
    resolved: {
      metrics: metricIdsCapped,
      regions: regionCodesCapped,
      levels,
      years: yearItems?.length ? yearItems : yearRange,
      scenarios: scenarioSel,
      measure: measureSel ?? null,
      data_type: dataTypeSel ?? null,
    },
    limits: {
      maxMetrics: 50,
      maxRegions: 500,
      maxRecords: MAX_RECORDS,
    },
    dropped: {
      metrics: metricIds.length - metricIdsCapped.length,
      regions: regionCodes.length - regionCodesCapped.length,
      records: records.length - out.length,
    },
  }

  return NextResponse.json({ meta, data: out })
}


