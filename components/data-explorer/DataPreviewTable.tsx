"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PivotTable } from "./PivotTable"

interface DataRow {
  Metric: string
  Region: string
  "Region Code": string
  Year: number
  Scenario: string
  Value: number | null
  Units: string
  "Data Type": string
  Source: string
}

export type ViewMode = "pivot" | "raw"

interface DataPreviewTableProps {
  data: DataRow[]
  isLoading?: boolean
  unit?: string
  defaultView?: ViewMode
}

type SortField = "Metric" | "Region" | "Year" | "Value"
type SortDir = "asc" | "desc"

function formatDisplay(raw: number | null, unit: string): string {
  if (raw == null) return "—"
  const num = Math.round(raw)
  let formatted = num.toLocaleString()
  if (unit && (unit.toLowerCase().includes("gbp") || unit.includes("£"))) {
    formatted = `£${formatted}`
  }
  return formatted
}

// View toggle component
function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode
  onChange: (view: ViewMode) => void
}) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted/30 p-0.5">
      <button
        type="button"
        onClick={() => onChange("pivot")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
          view === "pivot"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Pivot</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("raw")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
          view === "raw"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Raw</span>
      </button>
    </div>
  )
}

export function DataPreviewTable({
  data,
  isLoading,
  unit = "",
  defaultView = "pivot",
}: DataPreviewTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView)
  const [sortField, setSortField] = useState<SortField>("Year")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sortedData = useMemo(() => {
    const sorted = [...data]
    sorted.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]
      if (sortField === "Value") {
        aVal = aVal ?? -Infinity
        bVal = bVal ?? -Infinity
      }
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }
      if (sortDir === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })
    return sorted
  }, [data, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-muted/30 border-b" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b last:border-0 bg-muted/10" />
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <div className="text-muted-foreground">
          <p className="text-sm">No data to display</p>
          <p className="text-xs mt-1">Select metrics, regions, and years to query data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* View toggle header */}
      <div className="flex items-center justify-between">
        <ViewToggle view={viewMode} onChange={setViewMode} />
        <span className="text-xs text-muted-foreground">
          {viewMode === "pivot" ? "Time-series view" : "Database view"}
        </span>
      </div>

      {/* Table content */}
      {viewMode === "pivot" ? (
        <PivotTable data={data} unit={unit} />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left p-3 font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort("Metric")}
                    >
                      Metric
                      <SortIcon field="Metric" />
                    </Button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort("Region")}
                    >
                      Region
                      <SortIcon field="Region" />
                    </Button>
                  </th>
                  <th className="text-right p-3 font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort("Year")}
                    >
                      Year
                      <SortIcon field="Year" />
                    </Button>
                  </th>
                  <th className="text-left p-3 font-medium">Scenario</th>
                  <th className="text-right p-3 font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-medium hover:bg-transparent"
                      onClick={() => handleSort("Value")}
                    >
                      Value
                      <SortIcon field="Value" />
                    </Button>
                  </th>
                  <th className="text-left p-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.slice(0, 100).map((row, i) => (
                  <tr
                    key={`${row["Region Code"]}-${row.Year}-${row.Metric}-${i}`}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/20",
                      i % 2 === 0 ? "bg-background" : "bg-muted/5"
                    )}
                  >
                    <td className="p-3">
                      <span className="truncate max-w-[200px] block">{row.Metric}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          {row["Region Code"]}
                        </Badge>
                        <span className="truncate">{row.Region}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">{row.Year}</td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          row.Scenario === "Baseline" && "border-blue-500/30 text-blue-600 dark:text-blue-400",
                          row.Scenario === "Upside" && "border-green-500/30 text-green-600 dark:text-green-400",
                          row.Scenario === "Downside" && "border-orange-500/30 text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {row.Scenario}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums">
                      {formatDisplay(row.Value, row.Units || unit)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={row["Data Type"] === "Historical" ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {row["Data Type"]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 100 && (
            <div className="border-t p-3 text-center text-xs text-muted-foreground bg-muted/10">
              Showing 100 of {data.length.toLocaleString()} rows. Export for full dataset.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
