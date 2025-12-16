"use client"

import { useRef, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { ExportMenu } from "@/components/export-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { exportElementPng } from "@/lib/export/png"
import { exportXlsx, type ExportXlsxSheet } from "@/lib/export/xlsx"
import { isoDateStamp } from "@/lib/export/download"
import { downloadBlob } from "@/lib/export/download"

type ExportableChartCardProps = {
  /** Rendered chart/card content (typically a component that renders a full Card). */
  children: ReactNode
  /** Tidy/long rows representing exactly what is displayed. */
  rows: Record<string, any>[]
  /** Optional: separate CSV payload (since CSV has no number formatting). */
  csvRows?: Record<string, any>[]
  /** Base filename without extension. Date stamp is appended automatically. */
  filenameBase: string
  /** Optional: override XLSX sheets (e.g. include a wide-format sheet). */
  xlsxSheets?: ExportXlsxSheet[]
  /** When true, keep the export control in sync with the underlying card loading state. */
  isLoading?: boolean
  /** Optional: server-side export spec. If present, XLSX is generated via API route. */
  serverXlsxRequest?: {
    metricId: string
    /** For single-region exports */
    regionCode?: string
    /** For multi-region compare exports */
    regionCodes?: string[]
    /** For compare exports (single scenario selection) */
    scenario?: "baseline" | "upside" | "downside"
    scenarios?: Array<"baseline" | "upside" | "downside">
    filenameBase?: string
  }
}

export function ExportableChartCard({
  children,
  rows,
  csvRows,
  filenameBase,
  xlsxSheets,
  isLoading = false,
  serverXlsxRequest,
}: ExportableChartCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  const backgroundColor = theme === "dark" ? "#151922" : "#ffffff"
  const stamp = isoDateStamp()
  const pngName = `${filenameBase}_${stamp}.png`
  const xlsxName = `${filenameBase}_${stamp}.xlsx`
  const sheets: ExportXlsxSheet[] =
    xlsxSheets && xlsxSheets.length > 0 ? xlsxSheets : [{ name: "data", rows }]

  return (
    <div ref={ref} className="relative">
      {/* Place export controls below typical CardHeader title/badge row to avoid overlap. */}
      {/* Align to CardHeader padding (px-6) and match Badge (outline) sizing. */}
      <div className="absolute right-6 top-16 z-10" data-riq-hide-on-export="true">
        <div className="inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-sm bg-transparent shadow-sm">
          {isLoading ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <ExportMenu
              data={csvRows ?? rows}
              filename={filenameBase}
              disabled={!rows?.length}
              onExportPng={async () => {
                if (!ref.current) throw new Error("Missing capture node")
                await exportElementPng({ node: ref.current, filename: pngName, backgroundColor })
              }}
              onExportXlsx={async () => {
                if (serverXlsxRequest) {
                  const url = serverXlsxRequest.regionCodes?.length
                    ? "/api/export/xlsx/compare"
                    : "/api/export/xlsx"

                  const body =
                    serverXlsxRequest.regionCodes?.length
                      ? {
                          metricId: serverXlsxRequest.metricId,
                          regionCodes: serverXlsxRequest.regionCodes,
                          scenario: serverXlsxRequest.scenario,
                        }
                      : {
                          metricId: serverXlsxRequest.metricId,
                          regionCode: serverXlsxRequest.regionCode,
                          scenarios: serverXlsxRequest.scenarios,
                        }

                  const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  })
                  if (!res.ok) {
                    if (res.status === 401) {
                      const here = window.location.pathname + window.location.search
                      window.location.href = `/login?returnTo=${encodeURIComponent(here)}`
                      return
                    }
                    const msg = await res.text()
                    throw new Error(msg || "Server export failed")
                  }
                  const blob = await res.blob()
                  downloadBlob(blob, xlsxName)
                  return
                }

                await exportXlsx({ filename: xlsxName, sheets })
              }}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  )
}


