import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import { buildScenarioYearMatrix, computeInfo, normalizeUnits } from "@/lib/export/server-timeseries"
import { buildTimeseriesWorkbook } from "@/lib/export/server-workbook"
import { postObservationsQuery } from "@/lib/export/data-api-client"
import { sourceLabel } from "@/lib/export/canonical"
import { jobsMetricIdForRegion, jobsRegionCodeForQuery, remapJobsRegionCodeForOutput } from "@/lib/export/ni-jobs"

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

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scenarioList = (body.scenarios?.length
      ? body.scenarios
      : (["baseline", "upside", "downside"] as const)) as Scenario[]

    const metricIdForQuery = jobsMetricIdForRegion(body.metricId, body.regionCode)
    const regionCodeForQuery = jobsRegionCodeForQuery(body.metricId, body.regionCode)

    // Canonical source-of-truth: Data API observations (includes meta.citation/url/accessed_at).
    const requestBody = {
      query: [
        { code: "metric", selection: { filter: "item", values: [metricIdForQuery] } },
        { code: "region", selection: { filter: "item", values: [regionCodeForQuery] } },
        { code: "time_period", selection: { filter: "range", from: "1991", to: "2050" } },
        { code: "scenario", selection: { filter: "item", values: scenarioList } },
      ],
      response: { format: "records" },
      limit: 250000,
    }

    const api = await postObservationsQuery({ accessToken: token, requestBody })
    const records = (api?.data ?? []) as any[]

    const canonicalRows = records.map((r) => ({
      Metric: metric.title,
      Region: region.name,
      "Region Code": remapJobsRegionCodeForOutput(body.metricId, String(r.region_code ?? body.regionCode)),
      Year: r.time_period,
      Scenario: r.scenario === "baseline" ? "Baseline" : r.scenario === "upside" ? "Upside" : "Downside",
      Value: r.value ?? null,
      Units: metric.unit,
      "Data Type": String(r.data_type ?? "").toLowerCase() === "forecast" ? "Forecast" : "Historical",
      Source: sourceLabel({ dataType: r.data_type, dataQuality: r.data_quality }),
    }))

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

    const meta = api?.meta ?? {}
    const wb = await buildTimeseriesWorkbook({
      metricLabel: metric.title,
      regionLabel: region.name,
      regionCode: body.regionCode,
      units: normalizeUnits(metric.unit),
      scenarios: info.scenarios,
      coverage: info.coverage,
      sources: info.sources,
      generated: meta.generated_at ?? info.generated,
      vintage: meta.vintage,
      status: meta.status,
      citation: meta.citation,
      url: meta.url,
      accessedAt: meta.accessed_at,
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


