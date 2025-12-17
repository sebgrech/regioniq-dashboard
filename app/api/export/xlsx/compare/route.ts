import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import { buildRegionYearMatrix } from "@/lib/export/server-compare"
import { buildCompareWorkbook } from "@/lib/export/server-compare-workbook"
import { postObservationsQuery } from "@/lib/export/data-api-client"
import { sourceLabel } from "@/lib/export/canonical"
import { isNIRegionCode, jobsRegionCodeForQuery, remapJobsRegionCodeForOutput } from "@/lib/export/ni-jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  metricId: z.string().min(1),
  regionCodes: z.array(z.string().min(1)).min(1).max(5),
  scenario: z.enum(["baseline", "upside", "downside"]).default("baseline"),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const metric = METRICS.find((m) => m.id === body.metricId)
    if (!metric) return NextResponse.json({ error: "Unknown metric" }, { status: 400 })

    const regions = body.regionCodes
      .map((code) => REGIONS.find((r) => r.code === code))
      .filter(Boolean) as Array<(typeof REGIONS)[number]>
    if (regions.length !== body.regionCodes.length) {
      return NextResponse.json({ error: "Unknown region(s)" }, { status: 400 })
    }

    const scenario = body.scenario as Scenario

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // NI jobs are stored as `emp_total_jobs_ni` (and UKN jobs live at TLN0).
    // For compare exports we may have a mix of GB + NI regions, so we query BOTH metrics
    // and then filter the result set per-region.
    const isJobs = body.metricId === "emp_total_jobs"
    const originalRegions = body.regionCodes
    const queryToOriginal = new Map<string, string>()
    const regionsForQuery = originalRegions.map((code) => {
      const q = isJobs ? jobsRegionCodeForQuery(body.metricId, code) : code
      queryToOriginal.set(q, code)
      return q
    })
    const metricValuesForQuery = isJobs ? ["emp_total_jobs", "emp_total_jobs_ni"] : [body.metricId]

    const requestBody = {
      query: [
        { code: "metric", selection: { filter: "item", values: metricValuesForQuery } },
        { code: "region", selection: { filter: "item", values: regionsForQuery } },
        { code: "time_period", selection: { filter: "range", from: "1991", to: "2050" } },
        { code: "scenario", selection: { filter: "item", values: [scenario] } },
      ],
      response: { format: "records" },
      limit: 250000,
    }

    const api = await postObservationsQuery({ accessToken: token, requestBody })
    const records = (api?.data ?? []) as any[]

    const regionNameByCode = new Map(body.regionCodes.map((c) => [c, REGIONS.find((r) => r.code === c)?.name ?? c]))
    const scenarioLabel = scenario === "baseline" ? "Baseline" : scenario === "upside" ? "Upside" : "Downside"

    const canonicalRows: Record<string, any>[] = (records ?? [])
      .map((r: any) => {
        const apiRegion = String(r.region_code ?? "")
        const originalRegion = queryToOriginal.get(apiRegion) ?? remapJobsRegionCodeForOutput(body.metricId, apiRegion)
        const isNI = isNIRegionCode(originalRegion)
        const mid = String(r.metric_id ?? "")

        // For jobs, keep the correct metric per-region:
        // - NI regions: emp_total_jobs_ni
        // - GB regions: emp_total_jobs
        if (isJobs) {
          if (isNI && mid !== "emp_total_jobs_ni") return null
          if (!isNI && mid !== "emp_total_jobs") return null
        }

        return {
          Metric: metric.title,
          Region: regionNameByCode.get(originalRegion) ?? originalRegion,
          "Region Code": originalRegion,
          Year: r.time_period,
          Scenario: scenarioLabel,
          Value: r.value ?? null,
          Units: metric.unit,
          "Data Type": String(r.data_type ?? "").toLowerCase() === "forecast" ? "Forecast" : "Historical",
          Source: sourceLabel({ dataType: r.data_type, dataQuality: r.data_quality }),
        }
      })
      .filter(Boolean) as Record<string, any>[]

    const years = canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number") as number[]
    const coverage = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : ""

    const srcSet = new Set<string>()
    for (const r of canonicalRows) if (r.Source) srcSet.add(String(r.Source))
    const sources = Array.from(srcSet).join("; ")

    const matrix = buildRegionYearMatrix({ canonicalRows })

    const meta = api?.meta ?? {}
    const wb = await buildCompareWorkbook({
      metricLabel: metric.title,
      scenarioLabel,
      regionCodes: body.regionCodes,
      regionNames: body.regionCodes.map((c) => REGIONS.find((r) => r.code === c)?.name ?? c),
      units: metric.unit,
      coverage,
      sources,
      generated: meta.generated_at ?? new Date().toISOString(),
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
    const filename = `regioniq_compare_${body.metricId}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Export failed" }, { status: 400 })
  }
}


