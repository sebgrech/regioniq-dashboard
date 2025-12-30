"use client"

import { useCallback, useEffect, useMemo, useState, useRef, useTransition } from "react"
import { Download, RefreshCw, Code2, AlertCircle, Loader2, Check, FileText, FileSpreadsheet, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingOverlay, FadeUp } from "@/components/ui/animate"
import { FilterBarSkeleton, TableSkeleton } from "@/components/ui/skeletons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { YEARS, METRICS, type Scenario } from "@/lib/metrics.config"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { exportCSV } from "@/lib/export"
import { isoDateStamp, downloadBlob } from "@/lib/export/download"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"
import { useToast } from "@/hooks/use-toast"

import { MetricPicker } from "./MetricPicker"
import { RegionPicker } from "./RegionPicker"
import { YearPicker } from "./YearPicker"
import { ScenarioPicker } from "./ScenarioPicker"
import { DataPreviewTable } from "./DataPreviewTable"
import type { RegionIndexEntry, ApiQuery } from "./types"

interface DataExplorerProps {
  metricId: string
  region: string
  regions?: string | string[]
  year: number
  scenario: Scenario
  title?: string
  className?: string
}

export function DataExplorer({
  metricId,
  region,
  regions: initialRegions,
  year,
  scenario,
  className,
}: DataExplorerProps) {
  const { toast } = useToast()

  // State
  const [metrics, setMetrics] = useState<string[]>([metricId])
  const [regions, setRegions] = useState<string[]>(() => {
    if (initialRegions) {
      const parsed =
        typeof initialRegions === "string"
          ? initialRegions.split(",").filter(Boolean)
          : initialRegions.filter(Boolean)
      return parsed.length > 0 ? parsed : [region]
    }
    return [region]
  })
  const [selectedScenarios, setSelectedScenarios] = useState<Scenario[]>([scenario])
  const [selectedYears, setSelectedYears] = useState<number[]>([year])

  // Picker open states
  const [metricOpen, setMetricOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)

  // Data states
  const [regionIndex, setRegionIndex] = useState<Record<string, RegionIndexEntry> | null>(null)
  const [schema, setSchema] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiOpen, setApiOpen] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [copied, setCopied] = useState(false)

  // Debounce ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync props to state
  useEffect(() => setMetrics([metricId]), [metricId])
  useEffect(() => {
    if (initialRegions) {
      const parsed =
        typeof initialRegions === "string"
          ? initialRegions.split(",").filter(Boolean)
          : initialRegions.filter(Boolean)
      if (parsed.length > 0) {
        setRegions(parsed)
        return
      }
    }
    setRegions([region])
  }, [region, initialRegions])
  useEffect(() => setSelectedYears([year]), [year])
  useEffect(() => setSelectedScenarios([scenario]), [scenario])

  // Load region metadata
  useEffect(() => {
    fetch("/processed/region-index.json")
      .then((r) => r.json())
      .then(setRegionIndex)
      .catch(() => setRegionIndex(null))
  }, [])

  const availableYears = useMemo(() => {
    const min = Number(schema?.time_coverage?.min_year ?? YEARS.min)
    const max = Number(schema?.time_coverage?.max_year ?? YEARS.max)
    const from = Number.isFinite(min) ? min : YEARS.min
    const to = Number.isFinite(max) ? max : YEARS.max
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  }, [schema])

  const requestBody: ApiQuery = useMemo(() => {
    const years = selectedYears.length ? selectedYears : [year]
    return {
      query: [
        { code: "metric", selection: { filter: "item", values: metrics } },
        { code: "region", selection: { filter: "item", values: regions } },
        { code: "time_period", selection: { filter: "item", values: years.map(String) } },
        { code: "scenario", selection: { filter: "item", values: selectedScenarios } },
      ],
      response: { format: "records" },
      limit: 250000,
    }
  }, [metrics, regions, selectedYears, year, selectedScenarios])

  const dataUrl = "/api/v1/en/data/regional_observations"
  const schemaUrl = "/api/v1/en/stat/regional_observations"

  async function getAccessToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/access-token", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        return (json?.access_token as string | undefined) ?? null
      }
    } catch {
      // ignore
    }
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data.session?.access_token ?? null
  }

  async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    timeoutMs: number
  ) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(input, { ...(init ?? {}), signal: controller.signal })
    } finally {
      clearTimeout(t)
    }
  }

  async function fetchJsonOrThrow(res: Response) {
    const ct = res.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = (json as any)?.error?.message || (json as any)?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      return json
    }
    const text = await res.text().catch(() => "")
    const snippet = text.slice(0, 160).replace(/\s+/g, " ").trim()
    throw new Error(`Non-JSON response (HTTP ${res.status}). ${snippet ? `Body: ${snippet}` : ""}`.trim())
  }

  const run = useCallback(async () => {
    if (metrics.length === 0 || regions.length === 0 || selectedYears.length === 0) {
      setResult(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated")
      const res = await fetchWithTimeout(
        dataUrl,
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(requestBody),
        },
        20_000
      )
      const json = await fetchJsonOrThrow(res)
      setResult(json)
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Request timed out (20s). Try selecting fewer regions/years.")
        setResult(null)
        return
      }
      const msg = e?.message ?? "Query failed"
      const isNetworkFailure =
        msg === "Failed to fetch" ||
        msg === "Load failed" ||
        /NetworkError/i.test(msg) ||
        e?.name === "TypeError"
      setError(isNetworkFailure ? "Network error. Check your connection." : msg)
      setResult(null)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [metrics, regions, selectedYears, requestBody])

  // Auto-query with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      run()
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [run])

  // Load schema on mount
  useEffect(() => {
    async function loadSchema() {
      try {
        const token = await getAccessToken().catch(() => null)
        const res = await fetchWithTimeout(
          schemaUrl,
          token ? { headers: { authorization: `Bearer ${token}` } } : undefined,
          10_000
        )
        const json = await fetchJsonOrThrow(res)
        setSchema(json)
      } catch {
        // ignore
      }
    }
    loadSchema()
  }, [])

  // Label helpers
  const metricLabel = useCallback(
    (id: string) => METRICS.find((m) => m.id === id)?.title ?? id,
    []
  )
  const regionLabel = useCallback(
    (code: string) => regionIndex?.[code]?.name ?? code,
    [regionIndex]
  )

  // Transform result to canonical rows
  const canonicalRows = useMemo(() => {
    const rows = (result?.data ?? []) as any[]
    return rows.map((r) => ({
      Metric: metricLabel(r.metric_id ?? r.metric),
      Region: regionLabel(r.region_code ?? r.region),
      "Region Code": r.region_code ?? r.region,
      Year: r.time_period ?? r.year,
      Scenario: scenarioLabel(r.scenario),
      Value: typeof r.value === "number" ? r.value : r.value == null ? null : Number(r.value),
      Units: r.unit ?? "",
      "Data Type": dataTypeLabel(r.data_type),
      Source: sourceLabel({ dataType: r.data_type, dataQuality: (r as any).data_quality }),
    }))
  }, [result, metricLabel, regionLabel])

  const canonicalCsvRows = useMemo(() => {
    return canonicalRows.map((r: any) => ({
      ...r,
      Value: typeof r.Value === "number" ? Math.round(r.Value) : r.Value,
    }))
  }, [canonicalRows])

  const filenameBase = useMemo(() => {
    const safe = (s: string) =>
      String(s)
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .slice(0, 120)
    const m = metrics.length === 1 ? metrics[0] : `metrics-${metrics.length}`
    const r = regions.length === 1 ? regions[0] : `regions-${regions.length}`
    const s = selectedScenarios.length === 1 ? selectedScenarios[0] : `scenarios-${selectedScenarios.length}`
    return safe(`regioniq_regional_observations_${m}_${r}_${s}`)
  }, [metrics, regions, selectedScenarios])

  const handleExportCsv = () => {
    if (canonicalCsvRows.length) {
      exportCSV(canonicalCsvRows, filenameBase)
    }
  }

  const handleExportXlsx = async () => {
    const stamp = isoDateStamp()
    const xlsxName = `${filenameBase}_${stamp}.xlsx`
    try {
    const res = await fetch("/api/export/xlsx/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestBody,
        metrics,
        regions,
        scenarios: selectedScenarios,
        selectedYears,
      }),
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
      toast({ title: "Export complete", description: `Downloaded ${xlsxName}` })
    } catch (err: any) {
      toast({
        title: "Excel export failed",
        description: err?.message || "Unable to export Excel file",
        variant: "destructive",
      })
    }
  }

  const unit = useMemo(() => (result?.data?.[0]?.unit as string | undefined) ?? "", [result])

  // Close all pickers when one opens
  const closeOtherPickers = (current: string) => {
    if (current !== "metric") setMetricOpen(false)
    if (current !== "region") setRegionOpen(false)
    if (current !== "year") setYearOpen(false)
    if (current !== "scenario") setScenarioOpen(false)
  }

  // Handle copy link with feedback
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Show skeleton on initial load
  if (initialLoad && !result) {
    return (
      <div className={cn("space-y-6", className)}>
        <FilterBarSkeleton />
        <TableSkeleton rows={8} columns={6} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 page-enter", className)}>
      {/* Filter Bar with entrance animation */}
      <FadeUp delay={0}>
        <div className="flex flex-wrap items-center gap-2">
          <MetricPicker
            selected={metrics}
            onChange={setMetrics}
            open={metricOpen}
            onOpenChange={(open) => {
              if (open) closeOtherPickers("metric")
              setMetricOpen(open)
            }}
          />
          <RegionPicker
            selected={regions}
            onChange={setRegions}
            open={regionOpen}
            onOpenChange={(open) => {
              if (open) closeOtherPickers("region")
              setRegionOpen(open)
            }}
            regionIndex={regionIndex}
          />
          <YearPicker
            selected={selectedYears}
            onChange={setSelectedYears}
            availableYears={availableYears}
            open={yearOpen}
            onOpenChange={(open) => {
              if (open) closeOtherPickers("year")
              setYearOpen(open)
            }}
          />
          <ScenarioPicker
            selected={selectedScenarios}
            onChange={setSelectedScenarios}
            open={scenarioOpen}
            onOpenChange={(open) => {
              if (open) closeOtherPickers("scenario")
              setScenarioOpen(open)
            }}
          />

          <div className="flex-1" />

          {/* Status indicator - subtle inline loading */}
          <div
            className={cn(
              "flex items-center gap-2 text-sm text-muted-foreground transition-opacity duration-150",
              loading ? "opacity-100" : "opacity-0"
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">Updating...</span>
          </div>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!canonicalRows.length}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="animate-fade-in-scale">
              <DropdownMenuItem onClick={handleExportCsv}>
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Copy share link
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh button */}
          <Button variant="ghost" size="sm" onClick={run} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </FadeUp>

      {/* Error message with shake animation */}
      {error && (
        <FadeUp delay={50}>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm animate-shake">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Query failed</p>
              <p className="text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* Results summary */}
      {!error && canonicalRows.length > 0 && (
        <FadeUp delay={100}>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono">
              {canonicalRows.length.toLocaleString()} rows
            </Badge>
            <span>
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""} ×{" "}
              {regions.length} region{regions.length !== 1 ? "s" : ""} ×{" "}
              {selectedYears.length} year{selectedYears.length !== 1 ? "s" : ""} ×{" "}
              {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? "s" : ""}
            </span>
          </div>
        </FadeUp>
      )}

      {/* Data Table with optimistic UI overlay */}
      <FadeUp delay={150}>
        <LoadingOverlay isLoading={loading && canonicalRows.length > 0}>
          <DataPreviewTable data={canonicalRows} isLoading={loading && canonicalRows.length === 0} unit={unit} />
        </LoadingOverlay>
      </FadeUp>

      {/* API Section (collapsed by default) */}
      <Collapsible open={apiOpen} onOpenChange={setApiOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <Code2 className="h-3.5 w-3.5 mr-1.5" />
            {apiOpen ? "Hide" : "Show"} API details
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 space-y-4 p-4 rounded-lg border bg-muted/10">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Endpoint</div>
              <code className="text-xs bg-muted px-2 py-1 rounded">{dataUrl}</code>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Request body</div>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-[200px]">
                {JSON.stringify(requestBody, null, 2)}
              </pre>
            </div>
            {result && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Response ({(result?.data?.length ?? 0).toLocaleString()} records)
                </div>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-[200px]">
                  {JSON.stringify(result?.data?.slice(0, 5) ?? null, null, 2)}
                  {(result?.data?.length ?? 0) > 5 && "\n// ... truncated"}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
