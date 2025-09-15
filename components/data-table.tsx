"use client"

import { useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatValue, formatPercentage, calculateChange } from "@/lib/data-service"
import { REGIONS } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"
import type { DataPoint } from "@/lib/data-service"

interface DataTableProps {
  title: string
  description?: string
  data: {
    region: string
    metricId: string
    scenario: string
    data: DataPoint[]
  }[]
  unit: string
  year: number
  isLoading?: boolean
  className?: string
}

type SortField = "region" | "value" | "change"
type SortDirection = "asc" | "desc"

export function DataTable({ title, description, data, unit, year, isLoading = false, className }: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>("value")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [searchTerm, setSearchTerm] = useState("")

  // Process data for the table
  const tableData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((item) => {
      const region = REGIONS.find((r) => r.code === item.region)
      const currentYearData = item.data.find((d) => d.year === year)
      const previousYearData = item.data.find((d) => d.year === year - 1)

      const currentValue = currentYearData?.value || 0
      const previousValue = previousYearData?.value || 0
      const change = calculateChange(currentValue, previousValue)

      return {
        regionCode: item.region,
        regionName: region?.name || item.region,
        country: region?.country || "Unknown",
        value: currentValue,
        change,
        scenario: item.scenario,
        type: currentYearData?.type || "historical",
      }
    })
  }, [data, year])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = tableData

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.regionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.regionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.country.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "region":
          aValue = a.regionName
          bValue = b.regionName
          break
        case "value":
          aValue = a.value
          bValue = b.value
          break
        case "change":
          aValue = a.change
          bValue = b.change
          break
        default:
          return 0
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [tableData, searchTerm, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const handleExport = () => {
    // Create CSV content
    const headers = ["Region Code", "Region Name", "Country", "Value", "Change %", "Scenario", "Type"]
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedData.map((row) =>
        [
          row.regionCode,
          `"${row.regionName}"`,
          row.country,
          row.value,
          row.change.toFixed(1),
          row.scenario,
          row.type,
        ].join(","),
      ),
    ].join("\n")

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `regional-data-${year}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-64" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Search and filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search regions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredAndSortedData.length} regions
          </Badge>
        </div>

        {/* Data table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium"
                    onClick={() => handleSort("region")}
                  >
                    Region
                    <SortIcon field="region" />
                  </Button>
                </TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium"
                    onClick={() => handleSort("value")}
                  >
                    Value ({year})
                    <SortIcon field="value" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium"
                    onClick={() => handleSort("change")}
                  >
                    Change
                    <SortIcon field="change" />
                  </Button>
                </TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((row) => (
                <TableRow key={`${row.regionCode}-${row.scenario}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {row.regionCode}
                      </Badge>
                      <span className="font-medium">{row.regionName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{row.country}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatValue(row.value, unit)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-medium",
                        row.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {formatPercentage(row.change)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.type === "historical" ? "secondary" : "outline"} className="text-xs">
                      {row.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No regions found matching your search.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
