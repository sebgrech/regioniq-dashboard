import { downloadBlob } from "@/lib/export/download"

export type ExportXlsxSheet = {
  name: string
  /** Use either `rows` (json) or `aoa` (array-of-arrays). */
  rows?: Record<string, any>[]
  aoa?: any[][]
  /**
   * Optional per-column Excel number formats by header name.
   * Examples:
   * - Year: "0"
   * - Value columns: "#,##0"
   */
  columnFormats?: Record<string, string>
  /** Optional explicit column order for this sheet. */
  header?: string[]
  /** Optional column widths (wch = approx characters). */
  cols?: { wch: number }[]
  /** Optional merges for AOA sheets. */
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[]
  /** Optional freeze panes config (best-effort; depends on reader support). */
  freeze?: { xSplit: number; ySplit: number; topLeftCell?: string }
  /**
   * If provided, rows where Year >= forecastStartYear get a subtle styling cue.
   * Note: styling support depends on the `xlsx` writer; number formats always work.
   */
  forecastStartYear?: number
  /** V1: only one style option; keeps the cue subtle. */
  forecastStyle?: "subtle"
}

export type ExportXlsxOptions = {
  filename: string
  sheets: ExportXlsxSheet[]
}

/**
 * Export one or more sheets to an XLSX file.
 *
 * Uses `xlsx` via dynamic import to avoid SSR issues.
 */
export async function exportXlsx({ filename, sheets }: ExportXlsxOptions) {
  if (!sheets?.length) throw new Error("No sheets to export")

  const XLSX = await import("xlsx")

  const wb = XLSX.utils.book_new()

  for (const s of sheets) {
    const ws = s.aoa
      ? XLSX.utils.aoa_to_sheet(s.aoa)
      : XLSX.utils.json_to_sheet(s.rows ?? [], {
          header: s.header && s.header.length ? s.header : buildHeader(s.rows ?? []),
        })

    // Column widths / merges (typically for AOA-based Info sheets)
    if (s.cols) (ws as any)["!cols"] = s.cols
    if (s.merges) (ws as any)["!merges"] = s.merges

    const header =
      s.header && s.header.length
        ? s.header
        : s.aoa
          ? ((s.aoa?.[0] ?? []) as string[])
          : buildHeader(s.rows ?? [])

    applyColumnFormats(XLSX, ws, header, s.columnFormats)
    applyForecastCue(XLSX, ws, header, s.forecastStartYear, s.forecastStyle)
    applyFreeze(ws, s.freeze)
    XLSX.utils.book_append_sheet(wb, ws, s.name || "data")
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  downloadBlob(blob, filename)
}

function buildHeader(rows: Record<string, any>[]) {
  if (!rows?.length) return []
  const header: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const k of Object.keys(row ?? {})) {
      if (seen.has(k)) continue
      seen.add(k)
      header.push(k)
    }
  }
  return header
}

function applyColumnFormats(
  XLSX: any,
  ws: any,
  header: string[],
  columnFormats?: Record<string, string>,
) {
  if (!header.length) return

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1")
  if (range.e.r < 1) return // only header row present

  const fmt = columnFormats ?? {}

  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = header[c - range.s.c]
    if (!h) continue

    const key = h
    const keyLower = h.toLowerCase()

    // Default discipline:
    // - years should never have thousands separators
    // - other numeric columns default to integer with separators
    const defaultFormat = keyLower === "year" ? "0" : "0"
    const z = fmt[key] ?? fmt[keyLower] ?? defaultFormat

    // Apply to data rows (skip header row at r = 0)
    for (let r = 1; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue
      if (typeof cell.v !== "number") continue
      cell.z = z
    }
  }
}

function applyForecastCue(
  XLSX: any,
  ws: any,
  header: string[],
  forecastStartYear?: number,
  style?: "subtle",
) {
  if (!forecastStartYear) return
  if (!header.length) return

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1")
  if (range.e.r < 1) return

  const yearColIdx = header.findIndex((h) => (h || "").toLowerCase() === "year")
  if (yearColIdx < 0) return

  // SheetJS style objects are best-effort in OSS builds; if unsupported, this is a no-op at runtime.
  const subtleStyle =
    style === "subtle"
      ? {
          font: { color: { rgb: "666666" } },
        }
      : undefined

  if (!subtleStyle) return

  for (let r = 1; r <= range.e.r; r++) {
    const yearAddr = XLSX.utils.encode_cell({ r, c: range.s.c + yearColIdx })
    const yearCell = ws[yearAddr]
    const yearVal = typeof yearCell?.v === "number" ? yearCell.v : Number(yearCell?.v)
    if (!Number.isFinite(yearVal)) continue
    if (yearVal < forecastStartYear) continue

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell) continue
      cell.s = { ...(cell.s ?? {}), ...subtleStyle }
    }
  }
}

function applyFreeze(ws: any, freeze?: { xSplit: number; ySplit: number; topLeftCell?: string }) {
  if (!freeze) return
  // Best-effort: SheetJS supports !freeze in some builds/readers.
  ;(ws as any)["!freeze"] = {
    xSplit: freeze.xSplit,
    ySplit: freeze.ySplit,
    topLeftCell: freeze.topLeftCell,
  }
}


