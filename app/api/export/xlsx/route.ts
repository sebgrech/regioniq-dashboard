import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import {
  fetchTimeseriesForExport,
  buildCanonicalRows,
  buildScenarioYearMatrix,
  computeInfo,
  normalizeUnits,
} from "@/lib/export/server-timeseries"
import { buildTimeseriesWorkbook } from "@/lib/export/server-workbook"
import { jobsMetricIdForRegion } from "@/lib/export/ni-jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  metricId: z.string().min(1),
  regionCode: z.string().min(1),
  scenarios: z.array(z.enum(["baseline", "upside", "downside"])).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const metric = METRICS.find((m) => m.id === body.metricId)
    const region = REGIONS.find((r) => r.code === body.regionCode)
    if (!metric) return NextResponse.json({ error: "Unknown metric" }, { status: 400 })
    if (!region) return NextResponse.json({ error: "Unknown region" }, { status: 400 })

    const scenarioList = (body.scenarios?.length
      ? body.scenarios
      : (["baseline", "upside", "downside"] as const)) as Scenario[]

    // Use appropriate metric ID for NI jobs
    const metricIdForQuery = jobsMetricIdForRegion(body.metricId, body.regionCode)

    // Fetch data directly from Supabase (no external Data API dependency)
    const rows = await fetchTimeseriesForExport({
      supabase,
      metricId: metricIdForQuery,
      regionCode: body.regionCode,
    })

    // Build canonical rows from Supabase data
    const canonicalRows = buildCanonicalRows({
      metricId: body.metricId,
      regionCode: body.regionCode,
      rows,
      scenarios: scenarioList,
    })

    const matrix = buildScenarioYearMatrix({
      canonicalRows,
      scenarios: scenarioList.map((s) => (s === "baseline" ? "Baseline" : s === "upside" ? "Upside" : "Downside")),
    })

    const info = computeInfo({
      canonicalRows,
      metricLabel: metric.title,
      regionLabel: region.name,
      regionCode: body.regionCode,
      units: metric.unit,
    })

    const wb = await buildTimeseriesWorkbook({
      metricLabel: metric.title,
      regionLabel: region.name,
      regionCode: body.regionCode,
      units: normalizeUnits(metric.unit),
      scenarios: info.scenarios,
      coverage: info.coverage,
      sources: info.sources,
      generated: info.generated,
      vintage: undefined,
      status: undefined,
      citation: undefined,
      url: undefined,
      accessedAt: undefined,
      canonicalRows,
      matrixHeader: matrix.header,
      matrixRows: matrix.rows,
    })

    const out = await wb.xlsx.writeBuffer()
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as any)

    const filename = `regioniq_${body.metricId}_${body.regionCode}_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    const message = err?.message ?? "Export failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}


