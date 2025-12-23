import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import path from "path"
import { readFile } from "fs/promises"
import ExcelJS from "exceljs"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { METRICS, REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import { scenarioLabel, dataTypeLabel, sourceLabel } from "@/lib/export/canonical"
import { buildScenarioYearMatrix, computeInfo, normalizeUnits } from "@/lib/export/server-timeseries"
import { buildTimeseriesWorkbook } from "@/lib/export/server-workbook"
import { isNIRegionCode, jobsRegionCodeForQuery, remapJobsRegionCodeForOutput } from "@/lib/export/ni-jobs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  requestBody: z.any(),
  // Optional hints for nicer Info sheet.
  metrics: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  scenario: z.enum(["baseline", "upside", "downside"]).optional(),
  selectedYears: z.array(z.number()).optional(),
})

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"

const TABLE_BY_LEVEL: Record<RegionLevel, string> = {
  ITL1: "itl1_latest_all",
  ITL2: "itl2_latest_all",
  ITL3: "itl3_latest_all",
  LAD: "lad_latest_all",
}

function getDim(query: any[], code: string) {
  return query.find((q) => q?.code === code)?.selection
}

function selectionItems(sel: any): string[] | null {
  if (!sel) return null
  if (sel.filter === "all") return null
  if (sel.filter === "item" && Array.isArray(sel.values)) return sel.values
  return null
}

function selectionRange(sel: any): { from: number; to: number } | null {
  if (!sel || sel.filter !== "range") return null
  const from = Number(sel.from)
  const to = Number(sel.to)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return { from, to }
}

function selectionYears(sel: any): number[] | null {
  const items = selectionItems(sel)
  if (!items) return null
  const years = items.map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[]
  return years.length ? Array.from(new Set(years)).sort((a, b) => a - b) : null
}

function chooseMeasureForScenario(s: Scenario) {
  if (s === "upside") return "ci_upper" as const
  if (s === "downside") return "ci_lower" as const
  return "value" as const
}

function pickValue(row: any, measure: "value" | "ci_lower" | "ci_upper") {
  // Match existing product logic: historical always uses `value`.
  if (row.data_type === "historical") return row.value ?? null
  const v = row[measure]
  if (v == null) return row.value ?? null
  return v
}

function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!buf || buf.length < 24) return null
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  if (!isPng) return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

async function loadRegionIndex(): Promise<Record<string, { name?: string }>> {
  try {
    const p = path.join(process.cwd(), "public", "processed", "region-index.json")
    const txt = await readFile(p, "utf8")
    return JSON.parse(txt)
  } catch {
    return {}
  }
}

function buildScenarioYearMatrix(canonicalRows: Record<string, any>[]) {
  const years = Array.from(new Set(canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number"))).sort(
    (a: any, b: any) => Number(a) - Number(b),
  ) as number[]
  const header = ["Scenario \\ Year", ...years.map(String)]
  const scenOrder = ["Baseline", "Upside", "Downside"]
  const rows: Record<string, any>[] = []
  for (const scen of scenOrder) {
    const row: Record<string, any> = { "Scenario \\ Year": scen }
    for (const y of years) row[String(y)] = null
    for (const r of canonicalRows) {
      if (r.Scenario !== scen) continue
      const y = r.Year
      if (typeof y !== "number") continue
      row[String(y)] = r.Value ?? null
    }
    rows.push(row)
  }
  return { header, rows }
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Patch NI jobs export requests:
    // - include `emp_total_jobs_ni` alongside `emp_total_jobs`
    // - rewrite `UKN` -> `TLN0` for query (then remap back in output)
    const queryToOriginal = new Map<string, string>()
    let requestBody: any = body.requestBody
    try {
      const q = Array.isArray(body.requestBody?.query) ? body.requestBody.query : []
      const metricDim = q.find((d: any) => d?.code === "metric")
      const regionDim = q.find((d: any) => d?.code === "region")
      const metricSel = metricDim?.selection
      const regionSel = regionDim?.selection

      const metricValues: string[] =
        metricSel?.filter === "item" && Array.isArray(metricSel.values) ? metricSel.values : []
      const regionValues: string[] =
        regionSel?.filter === "item" && Array.isArray(regionSel.values) ? regionSel.values : []

      const isJobsOnly = metricValues.length === 1 && metricValues[0] === "emp_total_jobs"
      const includesJobs = metricValues.includes("emp_total_jobs")

      if ((isJobsOnly || includesJobs) && regionValues.length > 0) {
        const next = JSON.parse(JSON.stringify(body.requestBody))
        const nextQ = next.query as any[]
        const nextMetricDim = nextQ.find((d: any) => d?.code === "metric")
        const nextRegionDim = nextQ.find((d: any) => d?.code === "region")

        // Add `emp_total_jobs_ni` so NI regions can return rows
        if (nextMetricDim?.selection?.filter === "item") {
          const vals: string[] = Array.isArray(nextMetricDim.selection.values) ? nextMetricDim.selection.values : []
          if (vals.includes("emp_total_jobs") && !vals.includes("emp_total_jobs_ni")) {
            vals.push("emp_total_jobs_ni")
            nextMetricDim.selection.values = vals
          }
        }

        // Rewrite UKN->TLN0 for query (only relevant for jobs in this dataset)
        if (nextRegionDim?.selection?.filter === "item") {
          const vals: string[] = Array.isArray(nextRegionDim.selection.values) ? nextRegionDim.selection.values : []
          const rewritten = vals.map((c) => {
            const qc = jobsRegionCodeForQuery("emp_total_jobs", c)
            queryToOriginal.set(qc, c)
            return qc
          })
          nextRegionDim.selection.values = rewritten
        }

        requestBody = next
      }
    } catch {
      // If requestBody shape changes, fall back to raw request.
      requestBody = body.requestBody
    }

    // Use Supabase directly (no external Data API dependency needed)
    const query = Array.isArray(requestBody?.query) ? requestBody.query : []

    const metricValues = selectionItems(getDim(query, "metric")) ?? body.metrics ?? METRICS.map((m) => m.id)
    const regionValues = selectionItems(getDim(query, "region")) ?? body.regions ?? REGIONS.map((r) => r.code)
    const scenarioValuesRaw = selectionItems(getDim(query, "scenario")) ?? (body.scenario ? [body.scenario] : ["baseline"])
    const scenarioValues = scenarioValuesRaw.filter((s): s is Scenario =>
      ["baseline", "upside", "downside"].includes(String(s) as any)
    )
    const years = selectionYears(getDim(query, "year")) ?? selectionYears(getDim(query, "time_period"))
    const yearRange =
      selectionRange(getDim(query, "year")) ?? selectionRange(getDim(query, "time_period")) ?? { from: YEARS.min, to: YEARS.max }
    const dataTypeSel = selectionItems(getDim(query, "data_type"))

    const metricIdsCapped = metricValues.slice(0, 50)
    const regionCodesCapped = regionValues.slice(0, 500)

    const levels = (selectionItems(getDim(query, "level")) as RegionLevel[] | null) ?? (["ITL1", "ITL2", "ITL3", "LAD"] as RegionLevel[])
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

    const records: any[] = []
    for (const [lvl, dbCodes] of byLevel.entries()) {
      const table = TABLE_BY_LEVEL[lvl]
      if (!table) continue
      if (!dbCodes.length) continue

      const q = supabase
        .from(table)
        .select(
          "region_code, region_name, region_level, metric_id, period, value, ci_lower, ci_upper, unit, freq, data_type, vintage, forecast_run_date, forecast_version, is_calculated"
        )
        .in("region_code", dbCodes)
        .in("metric_id", metricIdsCapped)
        .order("metric_id", { ascending: true })
        .order("region_code", { ascending: true })
        .order("period", { ascending: true })

      if (years && years.length > 0) {
        q.in("period", years)
      } else {
        q.gte("period", yearRange.from).lte("period", yearRange.to)
      }

      if (dataTypeSel && dataTypeSel.length > 0) {
        q.in("data_type", dataTypeSel)
      }

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message, table }, { status: 500 })

      for (const row of data ?? []) {
        for (const scenario of (scenarioValues.length ? scenarioValues : (["baseline"] as Scenario[]))) {
          const measure = chooseMeasureForScenario(scenario)
          records.push({
            metric_id: row.metric_id,
            region_code: REGIONS.find((x) => x.dbCode === row.region_code)?.code ?? row.region_code,
            region_db: row.region_code,
            level: lvl,
            time_period: row.period,
            scenario,
            value: pickValue(row, measure),
            data_type: row.data_type,
            unit: row.unit,
          })
        }
      }
    }

    const json = {
      meta: {
        dataset: "regional_observations",
        source: "supabase",
        generated_at: new Date().toISOString(),
      },
      data: records,
    }

    const regionIndex = await loadRegionIndex()
    const metricTitle = new Map(METRICS.map((m) => [m.id, m.title]))

    const records = (json?.data ?? []) as any[]
    const canonicalRows = (records ?? [])
      .map((r: any) => {
        const apiRegion = String(r.region_code ?? "")
        const originalRegion = queryToOriginal.get(apiRegion) ?? remapJobsRegionCodeForOutput("emp_total_jobs", apiRegion)
        const mid = String(r.metric_id ?? "")

        // If we pulled both jobs metrics, keep the correct one per region:
        if (mid === "emp_total_jobs" || mid === "emp_total_jobs_ni") {
          const isNI = isNIRegionCode(originalRegion)
          if (isNI && mid !== "emp_total_jobs_ni") return null
          if (!isNI && mid !== "emp_total_jobs") return null
        }

        // Map NI jobs metric id back onto the UI metric id for labels.
        const displayMetricId = mid === "emp_total_jobs_ni" ? "emp_total_jobs" : mid

        return {
          Metric: metricTitle.get(displayMetricId) ?? displayMetricId,
          Region: regionIndex?.[originalRegion]?.name ?? originalRegion,
          "Region Code": originalRegion,
      Year: r.time_period,
      Scenario: scenarioLabel(r.scenario),
      Value: typeof r.value === "number" ? r.value : r.value == null ? null : Number(r.value),
      Units: r.unit ?? "",
      "Data Type": dataTypeLabel(r.data_type),
      Source: sourceLabel({ dataType: r.data_type, dataQuality: r.data_quality }),
        }
      })
      .filter(Boolean) as any[]

    const years = canonicalRows.map((r) => r.Year).filter((y) => typeof y === "number") as number[]
    const coverage = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : ""
    const sourcesSet = new Set<string>()
    for (const r of canonicalRows) if (r.Source) sourcesSet.add(String(r.Source))
    const sources = Array.from(sourcesSet).join("; ")
    const generated = new Date().toISOString()

    const metricsSel = body.metrics?.length
      ? body.metrics
      : Array.from(new Set(records.map((r) => r.metric_id))).slice(0, 5)
    const regionsSel = body.regions?.length
      ? body.regions
      : Array.from(new Set(records.map((r) => r.region_code))).slice(0, 5)
    const scenarioSel = body.scenario ?? (records?.[0]?.scenario as Scenario | undefined) ?? "baseline"

    const uniqueMetric = new Set(records.map((r) => r.metric_id))
    const uniqueRegion = new Set(records.map((r) => r.region_code))

    // If single metric + single region, reuse the exact same workbook builder as chart exports.
    if (uniqueMetric.size === 1 && uniqueRegion.size === 1) {
      const mid = Array.from(uniqueMetric)[0] as string
      const rc = Array.from(uniqueRegion)[0] as string
      const mLabel = metricTitle.get(mid) ?? mid
      const rLabel = regionIndex?.[rc]?.name ?? rc

      const matrix = buildScenarioYearMatrix({
        canonicalRows,
        scenarios: ["Baseline", "Upside", "Downside"],
      })

      const info = computeInfo({
        canonicalRows,
        metricLabel: mLabel,
        regionLabel: rLabel,
        regionCode: rc,
        units: canonicalRows?.[0]?.Units ?? "",
      })

      const meta = json?.meta ?? {}
      const wb = await buildTimeseriesWorkbook({
        metricLabel: mLabel,
        regionLabel: rLabel,
        regionCode: rc,
        units: normalizeUnits(String(canonicalRows?.[0]?.Units ?? "")),
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
      const filename = `regioniq_data_${new Date().toISOString().slice(0, 10)}.xlsx`
      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"${filename}\"`,
          "Cache-Control": "no-store",
        },
      })
    }

    // Fallback for multi-metric or multi-region exports (keeps export functional).
    const wb = new ExcelJS.Workbook()
    wb.creator = "RegionIQ"
    wb.created = new Date()

    // Info (tab 1) + logo
    const info = wb.addWorksheet("Info", { views: [{ state: "frozen", ySplit: 1 }] })
    info.columns = [
      { key: "A", width: 20 },
      { key: "B", width: 64 },
      { key: "C", width: 5 },
      { key: "D", width: 18 },
    ]
    info.getCell("A1").value = "RegionIQ: Economic Data Export"
    info.getCell("A1").font = { size: 16, bold: true }
    info.mergeCells("A1:C1")
    info.getCell("A2").value = "Regional observations"
    info.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF374151" } }
    info.mergeCells("A2:D2")

    try {
      const logoPath = path.join(process.cwd(), "public", "x.png")
      const image = await readFile(logoPath)
      const imageId = wb.addImage({ buffer: image, extension: "png" })
      const dims = getPngDimensions(image as Buffer)
      const targetW = 120
      const targetH = dims ? Math.round((targetW * dims.height) / dims.width) : 60
      info.addImage(imageId, { tl: { col: 3.15, row: 0.15 }, ext: { width: targetW, height: targetH } })
    } catch {}

    const startRow = 6
    const kv: Array<[string, string]> = [
      [
        "Metric",
        metricsSel.length === 1 ? (metricTitle.get(metricsSel[0]) ?? metricsSel[0]) : `${metricsSel.length} selected`,
      ],
      [
        "Regions",
        regionsSel.length === 1
          ? `${regionIndex?.[regionsSel[0]]?.name ?? regionsSel[0]} (${regionsSel[0]})`
          : `${regionsSel.length} selected`,
      ],
      ["Scenario", scenarioLabel(scenarioSel)],
      ["Data coverage", coverage],
      ["Source(s)", sources],
      ["Vintage", String(json?.meta?.vintage ?? "")],
      ["Status", String(json?.meta?.status ?? "")],
      ["Generated", generated],
      ["Citation", String(json?.meta?.citation ?? "")],
      ["URL", String(json?.meta?.url ?? "")],
    ].filter(([, v]) => String(v ?? "").trim().length > 0) as any

    info.getRow(startRow).values = ["Item", "Value"]
    info.getRow(startRow).font = { bold: true }
    info.getRow(startRow).eachCell((c) => {
      c.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } }
    })
    kv.forEach(([k, v], i) => {
      const r = startRow + 1 + i
      info.getCell(`A${r}`).value = k
      info.getCell(`B${r}`).value = v
      info.getCell(`A${r}`).font = { color: { argb: "FF6B7280" } }
    })

    const data = wb.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] })
    const dataHeader = ["Metric", "Region", "Region Code", "Year", "Scenario", "Value", "Units", "Data Type", "Source"]
    data.columns = dataHeader.map((h) => ({
      header: h,
      key: h,
      width: h === "Source" ? 26 : h === "Region" ? 22 : h === "Metric" ? 26 : 14,
    }))
    canonicalRows.forEach((r) => data.addRow(r))
    data.getRow(1).font = { bold: true }
    data.getColumn("Year").numFmt = "0"
    data.getColumn("Value").numFmt = "#,##0"

    const out = await wb.xlsx.writeBuffer()
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as any)
    const filename = `regioniq_data_${new Date().toISOString().slice(0, 10)}.xlsx`
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


