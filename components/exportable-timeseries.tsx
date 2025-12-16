"use client"

import { useMemo } from "react"
import { ChartTimeseries } from "@/components/chart-timeseries"
import { ExportableChartCard } from "@/components/exportable-chart-card"
import { timeseriesToLongRows, timeseriesToWideRows, timeseriesToScenarioYearRows } from "@/lib/export/timeseries"
import { YEARS } from "@/lib/metrics.config"
import type { DataPoint } from "@/lib/data-service"
import type { Scenario } from "@/lib/metrics.config"

export type ExportableTimeseriesProps = {
  title: string
  description?: string
  data: DataPoint[]
  additionalSeries?: { scenario: Scenario; data: DataPoint[]; color?: string }[]
  unit: string
  metricId: string
  /** Scenario that the primary `data` series represents (affects chart colour/legend label). */
  primaryScenario?: Scenario
  isLoading?: boolean
  className?: string
  disableZoom?: boolean
  /** Custom height for the chart (default: 400px) */
  height?: number
  /** Base filename without extension. Date stamp is appended automatically. */
  filenameBase: string
  /** Extra columns to add to every exported row. */
  exportMeta?: Record<string, any>
}

export function ExportableTimeseries({
  filenameBase,
  exportMeta,
  title,
  description,
  data,
  additionalSeries,
  unit,
  metricId,
  primaryScenario,
  isLoading,
  className,
  disableZoom,
  height,
}: ExportableTimeseriesProps) {
  const addl = useMemo(
    () => additionalSeries?.map(({ scenario, data }) => ({ scenario, data })) ?? [],
    [additionalSeries],
  )

  const rows = useMemo(
    () =>
      timeseriesToLongRows({
        baseline: data,
        additionalSeries: addl,
        unit,
        meta: exportMeta,
        primaryScenario,
      }),
    [data, addl, unit, exportMeta, primaryScenario],
  )

  // CSV has no number formatting; emit clean 0dp values (no solver precision).
  const csvRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        Value: typeof (r as any).Value === "number" ? Math.round((r as any).Value) : (r as any).Value,
      })),
    [rows],
  )

  const wideRows = useMemo(
    () =>
      timeseriesToWideRows({
        baseline: data,
        additionalSeries: addl,
        primaryScenario,
      }),
    [data, addl, primaryScenario],
  )

  const scenarioYearRows = useMemo(
    () =>
      timeseriesToScenarioYearRows({
        baseline: data,
        additionalSeries: addl,
        primaryScenario,
      }),
    [data, addl, primaryScenario],
  )

  const scenarioYearHeader = useMemo(() => {
    const first = (scenarioYearRows?.[0] ?? {}) as Record<string, any>
    const yearCols = Object.keys(first)
      .filter((k) => k !== "Scenario \\ Year")
      .filter((k) => /^\d{4}$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
    return ["Scenario \\ Year", ...yearCols]
  }, [scenarioYearRows])

  const infoRows = useMemo(() => {
    const metricLabel = (exportMeta as any)?.Metric ?? ""
    const regionLabel = (exportMeta as any)?.Region ?? ""
    const regionCode = (exportMeta as any)?.["Region Code"] ?? ""
    const unitsRaw = unit ?? ""
    const units =
      unitsRaw === "people"
        ? "People"
        : unitsRaw === "jobs"
          ? "Jobs"
          : unitsRaw
            ? unitsRaw.charAt(0).toUpperCase() + unitsRaw.slice(1)
            : ""

    const years = rows.map((r: any) => r?.Year).filter((y: any) => typeof y === "number") as number[]
    const minYear = years.length ? Math.min(...years) : null
    const maxYear = years.length ? Math.max(...years) : null

    const scenSet = new Set<string>()
    for (const r of rows as any[]) {
      if (r?.Scenario) scenSet.add(String(r.Scenario))
    }
    const scenarios = Array.from(scenSet.values()).join(", ")

    const srcSet = new Set<string>()
    for (const r of rows as any[]) {
      if (r?.Source) srcSet.add(String(r.Source))
    }
    const sources = Array.from(srcSet.values()).join("; ")

    return [
      { Item: "Metric", Value: metricLabel },
      { Item: "Region", Value: regionLabel },
      { Item: "Region Code", Value: regionCode },
      { Item: "Units", Value: units },
      { Item: "Scenarios", Value: scenarios },
      { Item: "Data coverage", Value: minYear && maxYear ? `${minYear}–${maxYear}` : "" },
      { Item: "Source(s)", Value: sources },
      { Item: "Generated", Value: new Date().toISOString() },
    ]
  }, [exportMeta, rows, unit])

  const infoAoa = useMemo(() => {
    const metricLabel = (exportMeta as any)?.Metric ?? ""
    const regionLabel = (exportMeta as any)?.Region ?? ""
    const regionCode = (exportMeta as any)?.["Region Code"] ?? ""

    const title = "RegionIQ: Economic Data Export"
    const subtitle = metricLabel
    const regionLine = regionLabel && regionCode ? `${regionLabel} (${regionCode})` : regionLabel || regionCode

    const table: any[][] = infoRows.map((r: any) => [r.Item, r.Value])

    // Top-right: small brand mark (image embedding requires ExcelJS / server-side generation)
    return [
      [title, null, null, "RegionIQ"],
      [subtitle, null, null, null],
      [regionLine, null, null, null],
      [],
      ["Item", "Value"],
      ...table,
    ]
  }, [exportMeta, infoRows])

  return (
    <ExportableChartCard
      rows={rows}
      csvRows={csvRows}
      filenameBase={filenameBase}
      isLoading={!!isLoading}
      serverXlsxRequest={{
        metricId,
        regionCode: (exportMeta as any)?.["Region Code"] ?? "",
        // If this is a single-scenario chart (e.g. Overview tab), export ONLY that scenario.
        // If this is an all-scenarios chart (additionalSeries present), export all three.
        scenarios:
          additionalSeries && additionalSeries.length > 0
            ? ["baseline", "upside", "downside"]
            : [primaryScenario ?? "baseline"],
      }}
      xlsxSheets={[
        {
          name: "Info",
          aoa: infoAoa,
          merges: [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
          ],
          cols: [{ wch: 18 }, { wch: 54 }, { wch: 6 }, { wch: 14 }],
          freeze: { xSplit: 0, ySplit: 1 },
        } as any,
        {
          name: "Data",
          rows,
          header: ["Metric", "Region", "Region Code", "Year", "Scenario", "Value", "Units", "Data Type", "Source"],
          columnFormats: { Year: "0", Value: "#,##0" },
          forecastStartYear: YEARS.forecastStart,
          forecastStyle: "subtle",
          freeze: { xSplit: 0, ySplit: 1 },
        } as any,
        {
          name: "Time Series",
          rows: scenarioYearRows as any[],
          header: scenarioYearHeader,
          // freeze first row+col
          freeze: { xSplit: 1, ySplit: 1, topLeftCell: "B2" },
          // default numeric format will apply to year columns; first column is text so ignored
          forecastStartYear: YEARS.forecastStart,
          forecastStyle: "subtle",
        } as any,
      ]}
    >
      <ChartTimeseries
        title={title}
        description={description}
        data={data}
        additionalSeries={additionalSeries}
        unit={unit}
        metricId={metricId}
        primaryScenario={primaryScenario}
        isLoading={isLoading}
        className={className}
        disableZoom={disableZoom}
        height={height}
      />
    </ExportableChartCard>
  )
}


