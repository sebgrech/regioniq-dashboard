import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { METRICS, REGIONS, type Scenario } from "@/lib/metrics.config"
import {
  fetchCompareSeries,
  buildCanonicalCompareRows,
  buildRegionYearMatrix,
} from "@/lib/export/server-compare"
import { buildCompareWorkbook } from "@/lib/export/server-compare-workbook"
import { jobsMetricIdForRegion } from "@/lib/export/ni-jobs"

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
    const scenarioLabel = scenario === "baseline" ? "Baseline" : scenario === "upside" ? "Upside" : "Downside"

    // Fetch data directly from Supabase for each region (no external Data API dependency)
    const allCanonicalRows: Record<string, any>[] = []

    for (const regionCode of body.regionCodes) {
      // Use appropriate metric ID for NI jobs
      const metricIdForQuery = jobsMetricIdForRegion(body.metricId, regionCode)

      const points = await fetchCompareSeries({
        supabase,
        metricId: metricIdForQuery,
        regionCode,
        scenario,
      })

      const regionRows = buildCanonicalCompareRows({
        metricId: body.metricId,
        regionCode,
        scenario,
        points,
      })

      allCanonicalRows.push(...regionRows)
    }

    const years = allCanonicalRows.map((r) => r.Year).filter((y) => typeof y === "number") as number[]
    const coverage = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : ""

    const srcSet = new Set<string>()
    for (const r of allCanonicalRows) if (r.Source) srcSet.add(String(r.Source))
    const sources = Array.from(srcSet).join("; ")

    const matrix = buildRegionYearMatrix({ canonicalRows: allCanonicalRows })

    const wb = await buildCompareWorkbook({
      metricLabel: metric.title,
      scenarioLabel,
      regionCodes: body.regionCodes,
      regionNames: body.regionCodes.map((c) => REGIONS.find((r) => r.code === c)?.name ?? c),
      units: metric.unit,
      coverage,
      sources,
      generated: new Date().toISOString(),
      vintage: undefined,
      status: undefined,
      citation: undefined,
      url: undefined,
      accessedAt: undefined,
      canonicalRows: allCanonicalRows,
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


