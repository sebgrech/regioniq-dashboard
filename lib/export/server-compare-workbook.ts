import path from "path"
import { readFile } from "fs/promises"
import ExcelJS from "exceljs"

function getPngDimensions(buf: Uint8Array): { width: number; height: number } | null {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  if (!b || b.length < 24) return null
  const isPng =
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  if (!isPng) return null
  const width = b.readUInt32BE(16)
  const height = b.readUInt32BE(20)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

export async function buildCompareWorkbook(params: {
  metricLabel: string
  scenarioLabel: string
  regionCodes: string[]
  regionNames: string[]
  units: string
  coverage: string
  sources: string
  vintage?: string
  status?: string
  citation?: string
  url?: string
  accessedAt?: string
  canonicalRows: Record<string, any>[]
  matrixHeader: string[]
  matrixRows: Record<string, any>[]
}) {
  const {
    metricLabel,
    scenarioLabel,
    regionCodes,
    regionNames,
    units,
    coverage,
    sources,
    vintage,
    status,
    citation,
    url,
    accessedAt,
    canonicalRows,
    matrixHeader,
    matrixRows,
  } = params

  const wb = new ExcelJS.Workbook()
  wb.creator = "RegionIQ"
  wb.created = new Date()

  // Info
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

  info.getCell("A2").value = `${metricLabel}: Comparison`
  info.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF374151" } }
  info.mergeCells("A2:D2")

  info.getCell("A3").value = `Scenario: ${scenarioLabel}`
  info.getCell("A3").font = { size: 11, color: { argb: "FF111827" } }
  info.mergeCells("A3:D3")

  // Logo (top-right)
  try {
    const logoPath = path.join(process.cwd(), "public", "x.png")
    const image = await readFile(logoPath)
    const imageBuf = Buffer.from(image)
    // ExcelJS' Buffer typing can lag Node's generic Buffer typing; runtime expects a Node Buffer.
    const imageId = wb.addImage({ buffer: imageBuf as any, extension: "png" })
    const dims = getPngDimensions(imageBuf)
    const targetW = 120
    const targetH = dims ? Math.round((targetW * dims.height) / dims.width) : 60
    info.addImage(imageId, { tl: { col: 3.15, row: 0.15 }, ext: { width: targetW, height: targetH } })
  } catch {}

  const startRow = 6
  const regionsStr = regionNames.join(", ")
  // ⚠️ Export metadata: "Published (weekly)" replaces per-request "Generated" timestamps
  // to align with the weekly publish contract. Vintage comes from Data API /version.
  const kv = [
    ["Metric", metricLabel],
    ["Regions", regionsStr],
    ["Region Codes", regionCodes.join(", ")],
    ["Units", units],
    ["Scenario", scenarioLabel],
    ["Data coverage", coverage],
    ["Source(s)", sources],
    ...(vintage ? [["Vintage", vintage]] : []),
    ...(vintage ? [["Published (weekly)", vintage]] : []),
    ...(status ? [["Status", status]] : []),
    ...(accessedAt ? [["Accessed", accessedAt]] : []),
    ...(citation ? [["Citation", citation]] : []),
    ...(url ? [["URL", url]] : []),
  ]

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

  // Data (canonical)
  const data = wb.addWorksheet("Data", { views: [{ state: "frozen", ySplit: 1 }] })
  const dataHeader = ["Metric", "Region", "Region Code", "Year", "Scenario", "Value", "Units", "Data Type", "Source"]
  data.columns = dataHeader.map((h) => ({
    header: h,
    key: h,
    width: h === "Source" ? 18 : h === "Region" ? 22 : h === "Metric" ? 26 : 14,
  }))
  canonicalRows.forEach((r) => data.addRow(r))
  data.getRow(1).font = { bold: true }
  data.getColumn("Year").numFmt = "0"
  data.getColumn("Value").numFmt = "#,##0"

  // Time Series (Region x Year)
  const ts = wb.addWorksheet("Time Series", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2" }],
  })
  ts.columns = matrixHeader.map((h, idx) => ({ header: h, key: h, width: idx === 0 ? 22 : 12 }))
  matrixRows.forEach((r) => ts.addRow(r))
  ts.getRow(1).font = { bold: true }
  for (let c = 2; c <= ts.columnCount; c++) ts.getColumn(c).numFmt = "#,##0"

  // Forecast/historical styling:
  // - Forecast values use indigo for clear visual separation (matches UI)
  const forecastFont = { color: { argb: "FF6366F1" } } // Indigo-500
  const historicalFont = { color: { argb: "FF374151" } } // Gray-700

  // IMPORTANT: Do NOT infer forecast cutovers from a global year.
  // Different region series can have different last-published historical years (e.g. UK vs LAD).
  // We therefore style forecast cells using API-derived `Data Type` per Region Code + Year,
  // without changing the Time Series sheet structure or values.
  const regionCodeByRegionLabel = new Map<string, string>()
  const isForecastByRegionCodeYear = new Set<string>()
  for (const r of canonicalRows ?? []) {
    const regionLabel = String(r.Region ?? "")
    const regionCode = String(r["Region Code"] ?? "")
    const year = typeof r.Year === "number" ? r.Year : Number(r.Year)
    const dataType = String(r["Data Type"] ?? "").toLowerCase()
    if (regionLabel && regionCode && !regionCodeByRegionLabel.has(regionLabel)) {
      regionCodeByRegionLabel.set(regionLabel, regionCode)
    }
    if (regionCode && Number.isFinite(year) && dataType === "forecast") {
      isForecastByRegionCodeYear.add(`${regionCode}::${year}`)
    }
  }

  // Style only the cells that correspond to forecast rows per the API.
  // NOTE: We intentionally avoid applying a historical font to preserve existing workbook styling.
  for (let r = 2; r <= ts.rowCount; r++) {
    const regionLabel = String(ts.getRow(r).getCell(1).value ?? "")
    const regionCode = regionCodeByRegionLabel.get(regionLabel)
    if (!regionCode) continue

    for (let c = 2; c <= ts.columnCount; c++) {
      const headerVal = String(ts.getRow(1).getCell(c).value ?? "")
      const yr = Number(headerVal)
      if (!Number.isFinite(yr)) continue

      if (isForecastByRegionCodeYear.has(`${regionCode}::${yr}`)) {
        const cell = ts.getRow(r).getCell(c)
        cell.font = { ...(cell.font ?? {}), ...forecastFont }
      }
    }
  }

  // Key on the left below table
  const keyStartRow = matrixRows.length + 3
  ts.getCell(`A${keyStartRow}`).value = "Key"
  ts.getCell(`A${keyStartRow}`).font = { bold: true, size: 10 }
  ts.getCell(`A${keyStartRow + 1}`).value = "Historical (ONS)"
  ts.getCell(`A${keyStartRow + 1}`).font = { size: 10, ...historicalFont }
  ts.getCell(`A${keyStartRow + 2}`).value = "Forecast (RegionIQ)"
  ts.getCell(`A${keyStartRow + 2}`).font = { size: 10, ...forecastFont }
  // Units (one row gap under the key)
  ts.getCell(`A${keyStartRow + 4}`).value = `Units: ${units}`

  return wb
}


