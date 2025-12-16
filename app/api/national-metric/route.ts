import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { Scenario } from "@/lib/metrics.config"
import { calculateChange } from "@/lib/data-service"

function pickScenarioValue(
  row: { value: number | null; ci_lower?: number | null; ci_upper?: number | null; data_type?: string | null },
  scenario: Scenario
): number {
  if (row.data_type === "historical") return row.value ?? 0
  switch (scenario) {
    case "baseline":
      return row.value ?? 0
    case "downside":
      return row.ci_lower ?? row.value ?? 0
    case "upside":
      return row.ci_upper ?? row.value ?? 0
    default:
      return row.value ?? 0
  }
}

async function fetchITL1Average(metricId: string, year: number, scenario: Scenario): Promise<number | null> {
  const { data, error } = await supabase
    .from("itl1_latest_all")
    .select("value, ci_lower, ci_upper, data_type")
    .eq("metric_id", metricId)
    .eq("period", year)

  if (error || !data || data.length === 0) return null

  const vals = data
    .map((row) => pickScenarioValue(row as any, scenario))
    .filter((v) => v != null && isFinite(v))

  if (!vals.length) return null
  const sum = vals.reduce((acc, v) => acc + v, 0)
  return sum / vals.length
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const metricId = body?.metricId as string | undefined
    const year = body?.year as number | undefined
    const scenario = body?.scenario as Scenario | undefined

    if (!metricId || !year || !scenario) {
      return NextResponse.json({ error: "metricId, year, scenario are required" }, { status: 400 })
    }

    const value = await fetchITL1Average(metricId, year, scenario)
    const previousValue = await fetchITL1Average(metricId, year - 1, scenario)
    const growth = value != null && previousValue != null ? calculateChange(value, previousValue) : null

    return NextResponse.json({
      metricId,
      year,
      scenario,
      value,
      previousValue,
      growth,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to compute national metric average" },
      { status: 500 }
    )
  }
}


