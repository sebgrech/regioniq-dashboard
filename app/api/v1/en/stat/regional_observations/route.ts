import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/api/require-user"
import { METRICS, REGIONS, YEARS, SCENARIOS } from "@/lib/metrics.config"

const QuerySchema = z.object({
  var: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.coerce.number().int().min(0).default(0),
})

type Variable = {
  code: string
  text: string
  values: string[]
  valueTexts?: string[]
  elimination?: boolean
  time?: boolean
  meta?: Record<string, any>
  nextCursor?: number | null
}

function paginate<T>(arr: T[], cursor: number, limit: number) {
  const slice = arr.slice(cursor, cursor + limit)
  const nextCursor = cursor + limit < arr.length ? cursor + limit : null
  return { slice, nextCursor }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    var: url.searchParams.get("var") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { var: varCode, search, limit, cursor } = parsed.data

  const dataset = "regional_observations"
  const title = "Regional observations (RegionIQ)"

  // v1 catalogue: sourced from app config (fast + deterministic).
  // This is compatible with a future DB-backed catalogue without changing the API shape.
  const metricValues = METRICS.map((m) => m.id)
  const metricTexts = METRICS.map((m) => m.title)

  const regionValuesAll = REGIONS.map((r) => r.code)
  const regionTextsAll = REGIONS.map((r) => r.name)

  const years = Array.from({ length: YEARS.max - YEARS.min + 1 }, (_, i) => String(YEARS.min + i))

  const baseVars: Record<string, Variable> = {
    metric: {
      code: "metric",
      text: "Indicator",
      values: metricValues,
      valueTexts: metricTexts,
      elimination: true,
    },
    region: {
      code: "region",
      text: "Region",
      values: regionValuesAll,
      valueTexts: regionTextsAll,
      elimination: true,
    },
    level: {
      code: "level",
      text: "Geography level",
      values: ["ITL1", "ITL2", "ITL3", "LAD"],
      valueTexts: ["ITL1", "ITL2", "ITL3", "LAD"],
    },
    scenario: {
      code: "scenario",
      text: "Scenario",
      values: [...SCENARIOS],
      valueTexts: ["Baseline", "Upside", "Downside"],
    },
    year: {
      code: "year",
      text: "Year",
      values: years,
      valueTexts: years,
      time: true,
    },
    measure: {
      code: "measure",
      text: "Measure",
      values: ["value", "ci_lower", "ci_upper"],
      valueTexts: ["Central", "Lower bound", "Upper bound"],
    },
    data_type: {
      code: "data_type",
      text: "Data type",
      values: ["historical", "forecast"],
      valueTexts: ["Historical", "Forecast"],
    },
  }

  function applySearch(v: Variable): Variable {
    if (!search) return v
    const s = search.toLowerCase()
    const pairs = v.values.map((val, i) => ({
      val,
      text: v.valueTexts?.[i] ?? val,
    }))
    const filtered = pairs.filter((p) => p.val.toLowerCase().includes(s) || p.text.toLowerCase().includes(s))
    return {
      ...v,
      values: filtered.map((p) => p.val),
      valueTexts: v.valueTexts ? filtered.map((p) => p.text) : undefined,
    }
  }

  if (varCode) {
    const v = baseVars[varCode]
    if (!v) return NextResponse.json({ error: `Unknown variable: ${varCode}` }, { status: 400 })
    const searched = applySearch(v)
    const { slice, nextCursor } = paginate(
      searched.values.map((val, i) => ({ val, text: searched.valueTexts?.[i] })),
      cursor,
      limit
    )

    const out: Variable = {
      ...searched,
      values: slice.map((x) => x.val),
      valueTexts: searched.valueTexts ? slice.map((x) => x.text ?? x.val) : undefined,
      nextCursor,
    }

    return NextResponse.json({ title, dataset, variables: [out] })
  }

  // Default: return all variables, but paginate the big ones (region/metric) with small caps.
  const metricPaged = paginate(metricValues.map((val, i) => ({ val, text: metricTexts[i] })), 0, Math.min(limit, 200))
  const regionPaged = paginate(regionValuesAll.map((val, i) => ({ val, text: regionTextsAll[i] })), 0, Math.min(limit, 200))

  const variables: Variable[] = [
    { ...baseVars.metric, values: metricPaged.slice.map((x) => x.val), valueTexts: metricPaged.slice.map((x) => x.text), nextCursor: metricPaged.nextCursor },
    { ...baseVars.region, values: regionPaged.slice.map((x) => x.val), valueTexts: regionPaged.slice.map((x) => x.text), nextCursor: regionPaged.nextCursor },
    baseVars.level,
    baseVars.scenario,
    baseVars.year,
    baseVars.measure,
    baseVars.data_type,
  ]

  return NextResponse.json({ title, dataset, variables })
}


