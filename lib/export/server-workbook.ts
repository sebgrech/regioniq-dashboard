import path from "path"
import { readFile } from "fs/promises"
import ExcelJS from "exceljs"
import { YEARS } from "@/lib/metrics.config"

function getPngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG signature + IHDR chunk contains width/height at fixed offsets.
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
  // IHDR data starts at byte 16: width(4), height(4)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

export async function buildTimeseriesWorkbook(params: {
  metricLabel: string
  regionLabel: string
  regionCode: string
  units: string
  scenarios: string
  coverage: string
  sources: string
  generated: string
  canonicalRows: Record<string, any>[]
  matrixHeader: string[]
  matrixRows: Record<string, any>[]
}) {
  const {
    metricLabel,
    regionLabel,
    regionCode,
    units,
    scenarios,
    coverage,
    sources,
    generated,
    canonicalRows,
    matrixHeader,
    matrixRows,
  } = params

  const wb = new ExcelJS.Workbook()
  wb.creator = "RegionIQ"
  wb.created = new Date()

  // ---------------- Info ----------------
  const info = wb.addWorksheet("Info", { views: [{ state: "frozen", ySplit: 1 }] })
  info.columns = [
    { key: "A", width: 20 },
    { key: "B", width: 60 },
    { key: "C", width: 5 },
    { key: "D", width: 18 },
  ]

  info.getCell("A1").value = "RegionIQ: Economic Data Export"
  info.getCell("A1").font = { size: 16, bold: true }
  info.mergeCells("A1:C1")
  info.getCell("A2").value = metricLabel
  info.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF374151" } }
  info.mergeCells("A2:D2")
  info.getCell("A3").value = `${regionLabel} (${regionCode})`
  info.getCell("A3").font = { size: 11, color: { argb: "FF111827" } }
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

  const startRow = 6
  const kv = [
    ["Metric", metricLabel],
    ["Region", regionLabel],
    ["Region Code", regionCode],
    ["Units", units],
    ["Scenarios", scenarios],
    ["Data coverage", coverage],
    ["Source(s)", sources],
    ["Generated", generated],
  ]

  info.getRow(startRow).values = ["Item", "Value"]
  info.getRow(startRow).font = { bold: true }
  info.getRow(startRow).alignment = { vertical: "middle" }
  info.getRow(startRow).eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } }
  })

  kv.forEach(([k, v], i) => {
    const r = startRow + 1 + i
    info.getCell(`A${r}`).value = k
    info.getCell(`B${r}`).value = v
    info.getCell(`A${r}`).font = { color: { argb: "FF6B7280" } }
  })

  // ---------------- Data (canonical) ----------------
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
  const forecastStart = YEARS.forecastStart

  // ---------------- Time Series (OE) ----------------
  const ts = wb.addWorksheet("Time Series", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2" }],
  })

  ts.columns = matrixHeader.map((h, idx) => ({
    header: h,
    key: h,
    width: idx === 0 ? 18 : 12,
  }))

  matrixRows.forEach((r) => ts.addRow(r))
  ts.getRow(1).font = { bold: true }
  for (let c = 2; c <= ts.columnCount; c++) {
    ts.getColumn(c).numFmt = "#,##0"
  }

  // Forecast/historical cue by year-columns (TEXT ONLY):
  // - Year headers remain bold/black
  // - Forecast values are darker grey text for clear separation
  const forecastFont = { color: { argb: "FF7A7A7A" } }

  for (let c = 2; c <= ts.columnCount; c++) {
    const headerVal = String(ts.getRow(1).getCell(c).value ?? "")
    const yr = Number(headerVal)
    if (!Number.isFinite(yr) || yr < forecastStart) continue
    // Apply only to data rows (keep header black+bold)
    for (let r = 2; r <= ts.rowCount; r++) {
      const cell = ts.getRow(r).getCell(c)
      cell.font = { ...(cell.font ?? {}), ...forecastFont }
    }
  }

  // Key on the LEFT side (below the table so it doesn't interfere with the OE-native matrix).
  // Baseline/Upside/Downside occupy rows 2-4; leave a gap and put the key starting at row 6.
  const keyStartRow = 6
  ts.getCell(`A${keyStartRow}`).value = "Key"
  ts.getCell(`A${keyStartRow}`).font = { bold: true }
  ts.getCell(`A${keyStartRow + 1}`).value = "Historical (ONS)"
  ts.getCell(`A${keyStartRow + 2}`).value = "Forecast (RegionIQ)"
  ts.getCell(`A${keyStartRow + 2}`).font = forecastFont
  // Units (one row gap under the key)
  ts.getCell(`A${keyStartRow + 4}`).value = `Units: ${units}`

  return wb
}


