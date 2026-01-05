import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import path from "path"
import { readFile } from "fs/promises"
import ExcelJS from "exceljs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LADContributionSchema = z.object({
  code: z.string(),
  name: z.string(),
  weight: z.number(),
  intersectionAreaKm2: z.number(),
  ladAreaKm2: z.number(),
  population: z.number(),
  gdhi: z.number(),
  employment: z.number(),
})

const BodySchema = z.object({
  result: z.object({
    population: z.number(),
    gdhi_total: z.number(),
    employment: z.number(),
    regions_used: z.number(),
    year: z.number(),
    scenario: z.string(),
    breakdown: z.array(LADContributionSchema),
  }),
  geofence: z.object({
    mode: z.enum(["circle", "polygon", "none"]),
    radiusKm: z.number().optional(),
    center: z.tuple([z.number(), z.number()]).optional(),
  }).nullable().optional(),
})

function formatCurrency(n: number): string {
  if (n >= 1e9) return `£${(n / 1e9).toFixed(2)}bn`
  if (n >= 1e6) return `£${(n / 1e6).toFixed(1)}m`
  return `£${Math.round(n).toLocaleString()}`
}

function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (!buf || buf.length < 24) return null
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  if (!isPng) return null
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  return { width, height }
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const { result, geofence } = body

    const wb = new ExcelJS.Workbook()
    wb.creator = "RegionIQ"
    wb.created = new Date()

    // ============ Info Sheet (matches Data Explorer format exactly) ============
    const info = wb.addWorksheet("Info", { views: [{ state: "frozen", ySplit: 1 }] })
    info.columns = [
      { key: "A", width: 20 },
      { key: "B", width: 60 },
      { key: "C", width: 5 },
      { key: "D", width: 18 },
    ]

    // Header section (matches Data Explorer)
    info.getCell("A1").value = "RegionIQ: Catchment Analysis"
    info.getCell("A1").font = { size: 16, bold: true }
    info.mergeCells("A1:C1")

    // Catchment type description
    const catchmentType = geofence?.mode === "circle"
      ? `Circle (${geofence.radiusKm ?? 10}km radius)`
      : geofence?.mode === "polygon"
        ? "Custom Polygon"
        : "Catchment Area"

    info.getCell("A2").value = catchmentType
    info.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF374151" } }
    info.mergeCells("A2:D2")

    info.getCell("A3").value = `${result.year} • ${result.scenario}`
    info.getCell("A3").font = { size: 11, color: { argb: "FF6B7280" } }
    info.mergeCells("A3:D3")

    // Logo (top-right), constrained
    try {
      const logoPath = path.join(process.cwd(), "public", "x.png")
      const image = await readFile(logoPath)
      const imageId = wb.addImage({ buffer: image, extension: "png" })
      const dims = getPngDimensions(image as Buffer)
      const targetW = 120
      const targetH = dims ? Math.round((targetW * dims.height) / dims.width) : 60
      info.addImage(imageId, {
        tl: { col: 3.15, row: 0.15 },
        ext: { width: targetW, height: targetH },
      })
    } catch {
      // If logo missing, keep workbook valid without it.
    }

    // Item/Value table starts at row 6 (like Data Explorer)
    const startRow = 6
    info.getRow(startRow).values = ["Item", "Value"]
    info.getRow(startRow).font = { bold: true }
    info.getRow(startRow).alignment = { vertical: "middle" }
    info.getRow(startRow).eachCell((c) => {
      c.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } }
    })

    // Build key-value rows (all as strings for consistent formatting)
    const kv: [string, string][] = [
      ["Total Population", Math.round(result.population).toLocaleString()],
      ["Total GDHI", formatCurrency(result.gdhi_total)],
      ["Total Employment", Math.round(result.employment).toLocaleString()],
      ["LADs Included", String(result.regions_used)],
      ["Year", String(result.year)],
      ["Scenario", result.scenario],
      ["Export Date", new Date().toISOString().slice(0, 10)],
    ]

    if (geofence?.center) {
      kv.push(["Center (lng, lat)", `${geofence.center[0].toFixed(4)}, ${geofence.center[1].toFixed(4)}`])
    }
    if (geofence?.radiusKm) {
      kv.push(["Radius (km)", String(geofence.radiusKm)])
    }

    kv.forEach(([k, v], i) => {
      const r = startRow + 1 + i
      info.getCell(`A${r}`).value = k
      info.getCell(`B${r}`).value = v
      info.getCell(`A${r}`).font = { color: { argb: "FF6B7280" } }
    })

    // ============ LAD Breakdown Sheet ============
    const breakdown = wb.addWorksheet("LAD Breakdown", { views: [{ state: "frozen", ySplit: 1 }] })
    const breakdownHeader = [
      "LAD Code",
      "LAD Name",
      "Weight (%)",
      "Intersection (km²)",
      "LAD Area (km²)",
      "Population",
      "GDHI (£)",
      "Employment",
    ]

    breakdown.columns = breakdownHeader.map((h) => ({
      header: h,
      key: h,
      width: h === "LAD Name" ? 28 : h === "LAD Code" ? 14 : 16,
    }))

    // Add data rows
    result.breakdown.forEach((lad) => {
      breakdown.addRow({
        "LAD Code": lad.code,
        "LAD Name": lad.name,
        "Weight (%)": Math.round(lad.weight * 1000) / 10,
        "Intersection (km²)": Math.round(lad.intersectionAreaKm2 * 10) / 10,
        "LAD Area (km²)": Math.round(lad.ladAreaKm2 * 10) / 10,
        "Population": Math.round(lad.population),
        "GDHI (£)": Math.round(lad.gdhi),
        "Employment": Math.round(lad.employment),
      })
    })

    // Style header
    breakdown.getRow(1).font = { bold: true }
    breakdown.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }

    // Format number columns
    breakdown.getColumn("Population").numFmt = "#,##0"
    breakdown.getColumn("GDHI (£)").numFmt = "£#,##0"
    breakdown.getColumn("Employment").numFmt = "#,##0"
    breakdown.getColumn("Weight (%)").numFmt = "0.0"
    breakdown.getColumn("Intersection (km²)").numFmt = "0.0"
    breakdown.getColumn("LAD Area (km²)").numFmt = "0.0"

    // Add totals row
    const totalRow = breakdown.rowCount + 2
    breakdown.getCell(`A${totalRow}`).value = "TOTAL"
    breakdown.getCell(`A${totalRow}`).font = { bold: true }
    breakdown.getCell(`F${totalRow}`).value = Math.round(result.population)
    breakdown.getCell(`G${totalRow}`).value = Math.round(result.gdhi_total)
    breakdown.getCell(`H${totalRow}`).value = Math.round(result.employment)
    breakdown.getRow(totalRow).font = { bold: true }
    breakdown.getRow(totalRow).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }

    // Write workbook
    const out = await wb.xlsx.writeBuffer()
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as any)
    const filename = `regioniq_catchment_analysis_${result.year}_${result.scenario}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("Catchment export error:", err)
    return NextResponse.json({ error: err?.message || "Export failed" }, { status: 400 })
  }
}

