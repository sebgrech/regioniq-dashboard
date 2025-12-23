"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ExportMenu } from "@/components/export-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Copy,
  RefreshCw,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"
import { YEARS, METRICS, type Scenario } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { exportCSV } from "@/lib/export"
import { isoDateStamp, downloadBlob } from "@/lib/export/download"
import { dataTypeLabel, scenarioLabel, sourceLabel } from "@/lib/export/canonical"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

type ApiSelection =
  | { filter: "item"; values: string[] }
  | { filter: "all" }
  | { filter: "range"; from: string; to: string }

type ApiQuery = {
  query: Array<{
    code: "metric" | "region" | "level" | "time_period" | "scenario" | "data_type"
    selection: ApiSelection
  }>
  response?: { format: "records" }
}

interface DataTabProps {
  metricId: string
  region: string
  /** Optional: pre-fill with multiple regions (comma-separated string or array) */
  regions?: string | string[]
  year: number
  scenario: Scenario
  title?: string
  className?: string
}

function formatDisplay(raw: number | null, unit: string): string {
  if (raw == null) return "—"
  const num = Math.round(raw)
  let formatted = num.toLocaleString()
  if (unit && (unit.toLowerCase().includes("gbp") || unit.includes("£"))) {
    formatted = `£${formatted}`
  } else if (unit && !unit.includes("£")) {
    formatted += ` ${unit}`
  }
  return formatted
}

function JsonTree({ value }: { value: any }) {
  if (value == null) return <span className="text-muted-foreground">null</span>
  if (typeof value !== "object") return <span className="font-mono">{JSON.stringify(value)}</span>
  if (Array.isArray(value)) {
    return (
      <div className="space-y-1">
        {value.slice(0, 200).map((v, i) => (
          <details key={i} className="rounded border bg-muted/20 px-2 py-1">
            <summary className="cursor-pointer text-xs font-mono">
              [{i}] {typeof v}
            </summary>
            <div className="pl-3 pt-1 text-xs">
              <JsonTree value={v} />
            </div>
          </details>
        ))}
        {value.length > 200 && <div className="text-xs text-muted-foreground">… truncated</div>}
      </div>
    )
  }
  return (
    <div className="space-y-1">
      {Object.entries(value).map(([k, v]) => (
        <details key={k} className="rounded border bg-muted/20 px-2 py-1">
          <summary className="cursor-pointer text-xs font-mono">
            {k}: {typeof v}
          </summary>
          <div className="pl-3 pt-1 text-xs">
            <JsonTree value={v} />
          </div>
        </details>
      ))}
    </div>
  )
}

type RegionIndexEntry = {
  name: string
  level: "ITL1" | "ITL2" | "ITL3" | "LAD"
  bbox?: [number, number, number, number]
}

const LEVEL_LABEL: Record<string, string> = {
  ITL1: "ITL1",
  ITL2: "ITL2",
  ITL3: "ITL3",
  LAD: "LAD",
}

const TL_TO_UK: Record<string, string> = {
  TLC: "UKC",
  TLD: "UKD",
  TLE: "UKE",
  TLF: "UKF",
  TLG: "UKG",
  TLH: "UKH",
  TLI: "UKI",
  TLJ: "UKJ",
  TLK: "UKK",
  TLL: "UKL",
  TLM: "UKM",
  TLN: "UKN",
}

function buildParentITL1Map(itlToLad: any): Record<string, string> {
  const out: Record<string, string> = {}
  const itl1 = itlToLad?.ITL1 ?? {}
  for (const tlCode of Object.keys(itl1)) {
    const uk = TL_TO_UK[tlCode] ?? null
    if (!uk) continue
    const lads: string[] = itl1[tlCode] ?? []
    for (const lad of lads) out[lad] = uk
  }
  for (const levelKey of ["ITL2", "ITL3"] as const) {
    const levelMap = itlToLad?.[levelKey] ?? {}
    for (const itlCode of Object.keys(levelMap)) {
      const lads: string[] = levelMap[itlCode] ?? []
      const firstParent = lads.map((x) => out[x]).find(Boolean)
      if (firstParent) out[itlCode] = firstParent
    }
  }
  return out
}

function MultiSelectChips({
  values,
  getLabel,
  onRemove,
  maxVisible = 6,
}: {
  values: string[]
  getLabel?: (v: string) => string
  onRemove: (v: string) => void
  maxVisible?: number
}) {
  if (!values.length) return <div className="text-xs text-muted-foreground">None selected</div>
  // Prevent visual blow-up when many values are selected.
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? values : values.slice(0, maxVisible)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visible.map((v) => (
        <Badge key={v} variant="secondary" className="flex items-center gap-1 pr-1">
          <span className="truncate max-w-[220px]">{getLabel ? getLabel(v) : v}</span>
          <button
            type="button"
            className="ml-1 rounded hover:bg-muted/60 p-0.5"
            onClick={() => onRemove(v)}
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      </div>
      {values.length > maxVisible && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show less" : `+${values.length - maxVisible} more`}
        </button>
      )}
    </div>
  )
}

const LadRow = memo(function LadRow({
  lad,
  selected,
  label,
  striped,
  onToggleCode,
}: {
  lad: string
  selected: boolean
  label: string
  striped: boolean
  onToggleCode: (code: string) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full text-left flex items-center gap-2 rounded px-2 py-2 hover:bg-muted/40",
        striped && "bg-muted/10",
        selected && "bg-muted/50"
      )}
      onClick={() => onToggleCode(lad)}
    >
      <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
      <span className="font-mono text-xs text-muted-foreground">{lad}</span>
      <span className="truncate text-sm">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">LAD</span>
    </button>
  )
})

export function MetricDataTab({ metricId, region, regions: initialRegions, year, scenario, title, className }: DataTabProps) {
  const [metrics, setMetrics] = useState<string[]>([metricId])
  // Support both single region prop and multi-region prop
  const [regions, setRegions] = useState<string[]>(() => {
    if (initialRegions) {
      const parsed = typeof initialRegions === "string" 
        ? initialRegions.split(",").filter(Boolean) 
        : initialRegions.filter(Boolean)
      return parsed.length > 0 ? parsed : [region]
    }
    return [region]
  })
  const [localScenario, setLocalScenario] = useState<Scenario>(scenario)
  const [selectedYears, setSelectedYears] = useState<number[]>([year])

  const [regionIndex, setRegionIndex] = useState<Record<string, RegionIndexEntry> | null>(null)
  const [itlToLad, setItlToLad] = useState<any>(null)
  const [parentITL1, setParentITL1] = useState<Record<string, string>>({})
  const [regionSearch, setRegionSearch] = useState("")
  const [metricOpen, setMetricOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [yearsOpen, setYearsOpen] = useState(false)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [openITL1, setOpenITL1] = useState<Record<string, boolean>>({})
  const [openITL2, setOpenITL2] = useState<Record<string, boolean>>({})
  const [openITL3, setOpenITL3] = useState<Record<string, boolean>>({})
  const [regionMode, setRegionMode] = useState<"search" | "browse">("search")

  const [schema, setSchema] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill/scoping behavior: always mirror the page selection by default.
  useEffect(() => setMetrics([metricId]), [metricId])
  useEffect(() => {
    // Support both single region and multi-region
    if (initialRegions) {
      const parsed = typeof initialRegions === "string" 
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
  useEffect(() => setLocalScenario(scenario), [scenario])

  // Load region metadata + hierarchy for tree/search UI.
  useEffect(() => {
    fetch("/processed/region-index.json")
      .then((r) => r.json())
      .then((json) => setRegionIndex(json))
      .catch(() => setRegionIndex(null))
    fetch("/processed/itl_to_lad.json")
      .then((r) => r.json())
      .then((json) => {
        setItlToLad(json)
        setParentITL1(buildParentITL1Map(json))
      })
      .catch(() => {
        setItlToLad(null)
        setParentITL1({})
      })
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
    const q: ApiQuery["query"] = [
      { code: "metric", selection: { filter: "item", values: metrics } },
      { code: "region", selection: { filter: "item", values: regions } },
      { code: "time_period", selection: { filter: "item", values: years.map(String) } },
      { code: "scenario", selection: { filter: "item", values: [localScenario] } },
    ]
    return { query: q, response: { format: "records" } }
  }, [metrics, regions, selectedYears, year, localScenario])

  const rawDataApiBase = (process.env.NEXT_PUBLIC_DATA_API_BASE_URL ?? "").trim()
  const dataApiBase = rawDataApiBase.replace(/\/$/, "")
  const dataUrl = `${dataApiBase}/api/v1/observations/query`
  const schemaUrl = `${dataApiBase}/api/v1/schema`

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

  async function getAccessToken(): Promise<string | null> {
    // Primary: cookie session (server-side login) -> mint token for the browser via same-origin endpoint.
    try {
      const res = await fetch("/api/auth/access-token", { cache: "no-store" })
      if (res.ok) {
        const json = await res.json()
        return (json?.access_token as string | undefined) ?? null
    }
    } catch {
      // ignore
    }

    // Fallback: client-side Supabase session (if ever used).
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    return data.session?.access_token ?? null
  }

  async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(input, { ...(init ?? {}), signal: controller.signal })
    } finally {
      clearTimeout(t)
    }
  }

  async function run() {
    setLoading(true)
    setError(null)
    try {
      if (!dataApiBase) {
        throw new Error(
          "Data API not configured. Set NEXT_PUBLIC_DATA_API_BASE_URL (e.g. http://localhost:8000) and restart the dev server."
        )
      }
      if (!/^https?:\/\//i.test(dataApiBase)) {
        throw new Error(
          `Invalid NEXT_PUBLIC_DATA_API_BASE_URL: "${rawDataApiBase}". Include protocol, e.g. http://localhost:8000.`
        )
      }
      const token = await getAccessToken()
      if (!token) throw new Error("Not authenticated (missing access token)")
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
      setResult(json as any)
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError(
          `Timed out calling the Data API (20s): ${dataUrl}. This is usually a Fly cold start, local network/VPN, or the API hanging on an upstream call.`
        )
        setResult(null)
        return
      }
      const msg = e?.message ?? "Query failed"
      const isNetworkFailure =
        msg === "Failed to fetch" ||
        msg === "Load failed" ||
        /NetworkError/i.test(msg) ||
        e?.name === "TypeError"
      setError(
        isNetworkFailure
          ? [
              `Failed to reach the Data API at ${dataUrl}.`,
              "Check: (1) FastAPI is running, (2) NEXT_PUBLIC_DATA_API_BASE_URL includes http://, (3) if the UI is on https, the Data API must also be https (mixed-content is blocked).",
            ].join(" ")
          : msg
      )
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadSchema() {
    try {
      if (!dataApiBase) return
      if (!/^https?:\/\//i.test(dataApiBase)) return
      // Schema is intentionally public (bootstraps the selector before auth resolves).
      // If a token exists, we can still send it, but we must not require it.
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

  useEffect(() => {
    loadSchema()
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId, region, scenario])

  const unit = useMemo(() => (result?.data?.[0]?.unit as string | undefined) ?? "", [result])
  const metricLabel = useMemo(() => {
    const m = new Map(METRICS.map((x) => [x.id, x.title]))
    return (id: string) => m.get(id) ?? id
  }, [])
  const regionLabel = useMemo(() => {
    return (code: string) => regionIndex?.[code]?.name ?? code
  }, [regionIndex])

  const canonicalRows = useMemo(() => {
    const rows = (result?.data ?? []) as any[]
    return rows.map((r) => ({
      Metric: metricLabel(r.metric_id),
      Region: regionLabel(r.region_code),
      "Region Code": r.region_code,
      Year: r.time_period,
      Scenario: scenarioLabel(r.scenario),
      Value: typeof r.value === "number" ? r.value : r.value == null ? null : Number(r.value),
      Units: r.unit ?? "",
      "Data Type": dataTypeLabel(r.data_type),
      Source: sourceLabel({ dataType: r.data_type, dataQuality: (r as any).data_quality }),
    }))
  }, [result, metricLabel, regionLabel])

  // Match chart exports: CSV uses the canonical row shape, with clean 0dp values.
  const canonicalCsvRows = useMemo(() => {
    return canonicalRows.map((r: any) => ({
      ...r,
      Value: typeof r.Value === "number" ? Math.round(r.Value) : r.Value,
    }))
  }, [canonicalRows])

  const infoRows = useMemo(() => {
    const m = result?.meta ?? {}
    const metricSummary = metrics.length === 1 ? metricLabel(metrics[0]) : `${metrics.length} metrics`
    const regionSummary =
      regions.length === 1 ? `${regionLabel(regions[0])} (${regions[0]})` : `${regions.length} regions`
    const yearSummary =
      selectedYears.length === 1
        ? String(selectedYears[0])
        : selectedYears.length > 1
          ? `${Math.min(...selectedYears)}–${Math.max(...selectedYears)} (${selectedYears.length} selected)`
          : ""
    const scenarioSummary = scenarioLabel(localScenario)
    return [
      { Item: "Dataset", Value: "Regional observations" },
      { Item: "Metric", Value: metricSummary },
      { Item: "Region", Value: regionSummary },
      { Item: "Time", Value: yearSummary },
      { Item: "Scenario", Value: scenarioSummary },
      { Item: "Vintage", Value: m?.vintage ?? "" },
      { Item: "Status", Value: m?.status ?? "" },
      { Item: "Source", Value: m?.source ?? "" },
      { Item: "Citation", Value: m?.citation ?? "" },
      { Item: "URL", Value: m?.url ?? "" },
      { Item: "Accessed", Value: m?.accessed_at ?? "" },
      { Item: "Generated", Value: m?.generated_at ?? "" },
    ].filter((r) => String((r as any).Value ?? "").trim().length > 0)
  }, [result, metrics, regions, selectedYears, localScenario, metricLabel, regionLabel])

  const infoAoa = useMemo(() => {
    const table: any[][] = infoRows.map((r: any) => [r.Item, r.Value])
    return [
      ["RegionIQ: Data Export", null, null, "RegionIQ"],
      ["Regional observations", null, null, null],
      [],
      ["Item", "Value"],
      ...table,
    ]
  }, [infoRows])

  const filenameBase = useMemo(() => {
    const safe = (s: string) => String(s).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 120)
    const m = metrics.length === 1 ? metrics[0] : `metrics-${metrics.length}`
    const r = regions.length === 1 ? regions[0] : `regions-${regions.length}`
    return safe(`regioniq_regional_observations_${m}_${r}_${localScenario}`)
  }, [metrics, regions, localScenario])

  const previewInfoRows = infoRows.slice(0, 20)
  const previewDataRows = canonicalRows.slice(0, 30)
  const previewTimeSeries = useMemo(() => {
    // Preview-only (matches XLSX Time Series tab for single-metric+single-region).
    const years = Array.from(new Set(canonicalRows.map((r: any) => r.Year).filter((y: any) => typeof y === "number"))).sort(
      (a: any, b: any) => Number(a) - Number(b)
    ) as number[]
    const header = ["Scenario \\ Year", ...years.map(String)]
    const rows: Record<string, any>[] = []
    for (const scen of ["Baseline", "Upside", "Downside"]) {
      const row: Record<string, any> = { "Scenario \\ Year": scen }
      for (const y of years) row[String(y)] = null
      for (const r of canonicalRows as any[]) {
        if (r.Scenario !== scen) continue
        if (typeof r.Year !== "number") continue
        row[String(r.Year)] = r.Value ?? null
      }
      rows.push(row)
    }
    // Keep preview compact
    const yearCols = header.slice(1, 10)
    const previewHeader = [header[0], ...yearCols]
    const previewRows = rows.map((r) => {
      const out: Record<string, any> = { "Scenario \\ Year": r["Scenario \\ Year"] }
      for (const y of yearCols) out[y] = r[y]
      return out
    })
    return { header: previewHeader, rows: previewRows }
  }, [canonicalRows])

  const [previewTab, setPreviewTab] = useState<"info" | "data" | "timeseries">("data")

  const regionTree = useMemo(() => {
    if (!itlToLad) return null
    const itl2ToLads: Record<string, string[]> = itlToLad?.ITL2 ?? {}
    const itl3ToLads: Record<string, string[]> = itlToLad?.ITL3 ?? {}

    // ITL3 -> ITL2 mapping: prefer prefix, fallback to set inclusion.
    const itl2LadSets = Object.fromEntries(
      Object.entries(itl2ToLads).map(([k, lads]) => [k, new Set(lads)])
    ) as Record<string, Set<string>>

    const itl3ToItl2: Record<string, string> = {}
    for (const itl3 of Object.keys(itl3ToLads)) {
      const pref = itl3.slice(0, 4)
      if (itl2ToLads[pref]) {
        itl3ToItl2[itl3] = pref
        continue
      }
      const lads = itl3ToLads[itl3] ?? []
      for (const [itl2, ladSet] of Object.entries(itl2LadSets)) {
        let ok = true
        for (const lad of lads) {
          if (!ladSet.has(lad)) {
            ok = false
            break
          }
        }
        if (ok) {
          itl3ToItl2[itl3] = itl2
          break
        }
      }
    }

    // LAD -> ITL3 mapping for auto-expansion to selected.
    const ladToItl3: Record<string, string> = {}
    for (const [itl3, lads] of Object.entries(itl3ToLads)) {
      for (const lad of lads) ladToItl3[lad] = itl3
    }

    // Build ITL1(UK*) -> ITL2 -> ITL3 -> LAD[]
    const out: Record<string, Record<string, Record<string, string[]>>> = {}
    const itl2ToItl1: Record<string, string> = {}
    for (const itl2 of Object.keys(itl2ToLads)) {
      const itl1 = parentITL1[itl2] ?? parentITL1[(itl2ToLads[itl2] ?? [])[0] ?? ""]
      if (itl1) itl2ToItl1[itl2] = itl1
    }

    for (const itl2 of Object.keys(itl2ToLads)) {
      const itl1 = itl2ToItl1[itl2]
      if (!itl1) continue
      out[itl1] = out[itl1] ?? {}
      out[itl1][itl2] = out[itl1][itl2] ?? {}
    }

    for (const itl3 of Object.keys(itl3ToLads)) {
      const itl2 = itl3ToItl2[itl3]
      const itl1 = itl2 ? itl2ToItl1[itl2] : parentITL1[itl3]
      if (!itl1 || !itl2) continue
      out[itl1] = out[itl1] ?? {}
      out[itl1][itl2] = out[itl1][itl2] ?? {}
      out[itl1][itl2][itl3] = itl3ToLads[itl3] ?? []
    }

    return { tree: out, ladToItl3, itl3ToItl2, itl2ToItl1 }
  }, [itlToLad, parentITL1])

  // Auto-expand canonical hierarchy to show the current page region as a selected node (not typed search).
  useEffect(() => {
    if (!regionOpen) return
    if (!regionTree) return
    if (regionMode !== "browse") return

    const current = region
    let itl1: string | null = null
    let itl2: string | null = null
    let itl3: string | null = null

    const level = regionIndex?.[current]?.level
    if (level === "ITL1") {
      itl1 = current
    } else if (level === "ITL2") {
      itl2 = current
      itl1 = regionTree.itl2ToItl1[itl2] ?? null
    } else if (level === "ITL3") {
      itl3 = current
      itl2 = regionTree.itl3ToItl2[itl3] ?? null
      itl1 = (itl2 && regionTree.itl2ToItl1[itl2]) ?? parentITL1[itl3] ?? null
    } else {
      // LAD or unknown
      itl3 = regionTree.ladToItl3[current] ?? null
      itl2 = itl3 ? regionTree.itl3ToItl2[itl3] ?? null : null
      itl1 = (itl2 && regionTree.itl2ToItl1[itl2]) ?? (itl3 ? parentITL1[itl3] : null) ?? parentITL1[current] ?? null
    }

    if (itl1) setOpenITL1((m) => ({ ...m, [itl1!]: true }))
    if (itl2) setOpenITL2((m) => ({ ...m, [itl2!]: true }))
    if (itl3) setOpenITL3((m) => ({ ...m, [itl3!]: true }))
    // don't auto-fill search; keep it user-driven
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionOpen, region, regionTree, regionMode])

  // Keyboard affordance: focus the region search input when region panel opens.
  useEffect(() => {
    if (!regionOpen) return
    const t = setTimeout(() => {
      document.querySelector<HTMLInputElement>("#region-search")?.focus()
    }, 0)
    return () => clearTimeout(t)
  }, [regionOpen])

  const timeSummary = useMemo(() => {
    const ys = selectedYears.slice().sort((a, b) => a - b)
    if (!ys.length) return "—"
    if (ys.length <= 3) return ys.join(", ")
    return `${ys.length} selected`
  }, [selectedYears])

  const scenarioSummary = useMemo(() => localScenario, [localScenario])

  function openOnly(section: "metric" | "region" | "time" | "scenario") {
    setMetricOpen(section === "metric")
    setRegionOpen(section === "region")
    setYearsOpen(section === "time")
    setScenarioOpen(section === "scenario")
  }

  const toggleRegionCode = useCallback((code: string) => {
    setRegions((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]))
  }, [])

  const addRegionCodes = useCallback((codes: string[]) => {
    setRegions((cur) => {
      const set = new Set(cur)
      for (const c of codes) set.add(c)
      return Array.from(set)
    })
  }, [])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Data selector</CardTitle>
            <CardDescription>Choose dimensions, then show table.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={run} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Show table
            </Button>
            <ExportMenu
              data={canonicalCsvRows}
              filename={filenameBase}
              disabled={!canonicalRows.length}
              onExportXlsx={async () => {
                const stamp = isoDateStamp()
                const xlsxName = `${filenameBase}_${stamp}.xlsx`
                const res = await fetch("/api/export/xlsx/data", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    requestBody,
                    metrics,
                    regions,
                    scenario: localScenario,
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
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PxWeb-style selector */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Dataset</div>
              <div className="text-sm font-medium">Regional observations</div>
              {(schema?.vintage || schema?.status || schema?.source) && (
                <div className="text-xs text-muted-foreground">
                  {(schema?.vintage ? `Vintage ${schema.vintage}` : null) ?? ""}
                  {schema?.vintage && (schema?.status || schema?.source) ? " • " : ""}
                  {schema?.status ? `${schema.status}` : ""}
                  {schema?.status && schema?.source ? " • " : ""}
                  {schema?.source ? `${schema.source}` : ""}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground max-w-[520px]">
              Select values for each dimension, then click <span className="font-medium">Show table</span>.
          </div>
        </div>

          {/* Selection bar (single summary axis) */}
          <div className="rounded-lg bg-muted/20 px-3 py-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                "text-xs rounded-md px-2 py-1 border bg-background hover:bg-muted/40 transition-colors",
                metricOpen && "bg-muted/40"
              )}
              onClick={() => openOnly("metric")}
            >
              <span className="text-muted-foreground">Metric:</span>{" "}
              <span className="font-medium">{metrics.length ? `${metrics.length} selected` : "—"}</span>
            </button>
            <button
              type="button"
              className={cn(
                "text-xs rounded-md px-2 py-1 border bg-background hover:bg-muted/40 transition-colors",
                regionOpen && "bg-muted/40"
              )}
              onClick={() => openOnly("region")}
            >
              <span className="text-muted-foreground">Region:</span>{" "}
              <span className="font-medium">{regions.length ? `${regions.length} selected` : "—"}</span>
            </button>
            <button
              type="button"
              className={cn(
                "text-xs rounded-md px-2 py-1 border bg-background hover:bg-muted/40 transition-colors",
                yearsOpen && "bg-muted/40"
              )}
              onClick={() => openOnly("time")}
            >
              <span className="text-muted-foreground">Time:</span>{" "}
              <span className="font-medium">{timeSummary}</span>
            </button>
            <button
              type="button"
              className={cn(
                "text-xs rounded-md px-2 py-1 border bg-background hover:bg-muted/40 transition-colors",
                scenarioOpen && "bg-muted/40"
              )}
              onClick={() => openOnly("scenario")}
            >
              <span className="text-muted-foreground">Scenario:</span>{" "}
              <span className="font-medium font-mono">{scenarioSummary}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Metric */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-2 lg:col-span-2">
              <details open={metricOpen} onToggle={(e) => setMetricOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div className="text-sm font-medium">Metric</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{metrics.length ? `${metrics.length} selected` : "None selected"}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", metricOpen && "rotate-180")} />
                  </div>
                </summary>

                {!metricOpen && (
                  <div className="mt-2">
                    <MultiSelectChips
                      values={metrics}
                      getLabel={(v) => metricLabel(v)}
                      onRemove={(v) => setMetrics((cur) => cur.filter((x) => x !== v))}
                    />
                  </div>
                )}

                {metricOpen && (
                  <div className="mt-2 space-y-2">
                    <Command className="border rounded-md bg-background">
                      <CommandInput placeholder="Search metrics…" />
                      <CommandList className="max-h-[260px]">
                        <CommandEmpty>No metrics found.</CommandEmpty>
                        <CommandGroup heading="Indicators">
                          {METRICS.map((m) => {
                            const selected = metrics.includes(m.id)
                            return (
                              <CommandItem
                                key={m.id}
                                value={`${m.id} ${m.title}`}
                                onSelect={() =>
                                  setMetrics((cur) =>
                                    selected ? cur.filter((x) => x !== m.id) : [...cur, m.id]
                                  )
                                }
                              >
                                <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">{m.title}</span>
                                <Badge variant="outline" className="text-xs ml-auto">
                                  {m.id}
                                </Badge>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {metrics.length ? `${metrics.length} selected` : "Select at least one metric."}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setMetrics([])}
                        disabled={!metrics.length}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </details>
            </div>

            {/* Region */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-2 lg:col-span-2">
              <details open={regionOpen} onToggle={(e) => setRegionOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div className="text-sm font-medium">Region</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{regions.length ? `${regions.length} selected` : "None selected"}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", regionOpen && "rotate-180")} />
                  </div>
                </summary>

                {!regionOpen && (
                  <div className="mt-2">
                    <MultiSelectChips
                      values={regions}
                      getLabel={(v) => regionLabel(v)}
                      onRemove={(v) => setRegions((cur) => cur.filter((x) => x !== v))}
                    />
                  </div>
                )}

                {regionOpen && (
                  <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background flex-1">
                      <Search className="h-4 w-4 opacity-50" />
              <Input
                        id="region-search"
                        className="border-0 px-0 h-8 focus-visible:ring-0"
                        placeholder="Search regions by name or code"
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
              />
                    </div>
              <Button
                type="button"
                variant="outline"
                      size="sm"
                      className="h-10"
                      onClick={() => setRegionMode((m) => (m === "search" ? "browse" : "search"))}
                      disabled={!regionTree}
              >
                      {regionMode === "search" ? "Browse by hierarchy" : "Search mode"}
              </Button>
            </div>

                  <div className="border rounded-md max-h-[300px] overflow-auto bg-background">
                    {!regionIndex ? (
                      <div className="p-3 text-sm text-muted-foreground">Loading region index…</div>
                    ) : regionMode === "browse" && regionTree ? (
                      <div className="p-2 space-y-3">
                        {Object.keys(regionTree.tree)
                          .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
                          .map((itl1, itl1Idx) => {
                            const itl2Map = regionTree.tree[itl1] ?? {}
                            const itl1Expanded = !!openITL1[itl1]
                            const itl1Selected = regions.includes(itl1)
                            return (
                              <div key={itl1} className={cn("rounded-md px-2 py-1 hover:bg-muted/40", itl1Idx % 2 === 0 && "bg-muted/10")}>
                                <div className="flex items-center gap-2">
                    <button
                                    type="button"
                                    className="h-7 w-7 grid place-items-center rounded hover:bg-muted/50"
                                    onClick={() => setOpenITL1((m) => ({ ...m, [itl1]: !itl1Expanded }))}
                                    aria-label={itl1Expanded ? "Collapse" : "Expand"}
                                  >
                                    <ChevronRight className={cn("h-4 w-4 transition-transform", itl1Expanded && "rotate-90")} />
                    </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex items-center gap-2 min-w-0 flex-1 rounded px-1 py-1 hover:bg-muted/50",
                                      itl1Selected && "bg-muted/50 border-l-2 border-primary"
                                    )}
                                    onClick={(e) => {
                                      if (e.altKey) {
                                        const childCodes = Object.values(itl2Map).flatMap((itl3Map: any) =>
                                          Object.values(itl3Map as Record<string, string[]>).flat()
                                        ) as string[]
                                        addRegionCodes([itl1, ...childCodes])
                                      } else {
                                        toggleRegionCode(itl1)
                                      }
                                    }}
                                  >
                                    <Check className={cn("h-4 w-4", itl1Selected ? "opacity-100" : "opacity-0")} />
                                    <span className="font-mono text-xs text-muted-foreground">{itl1}</span>
                                    <span className="truncate text-sm">{regionLabel(itl1)}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">ITL1</span>
                                  </button>
              </div>

                                {itl1Expanded && (
                                  <div className="mt-1 pl-9 border-l space-y-1 transition-all duration-150 ease-out">
                                    {Object.keys(itl2Map)
                                      .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
                                      .map((itl2, itl2Idx) => {
                                        const itl3Map = itl2Map[itl2] ?? {}
                                        const itl2Expanded = !!openITL2[itl2]
                                        const itl2Selected = regions.includes(itl2)
                                        return (
                                          <div key={itl2} className={cn("rounded px-1 py-1 hover:bg-muted/30", itl2Idx % 2 === 0 && "bg-muted/10")}>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                className="h-7 w-7 grid place-items-center rounded hover:bg-muted/50"
                                                onClick={() => setOpenITL2((m) => ({ ...m, [itl2]: !itl2Expanded }))}
                                                aria-label={itl2Expanded ? "Collapse" : "Expand"}
                                              >
                                                <ChevronRight className={cn("h-4 w-4 transition-transform", itl2Expanded && "rotate-90")} />
                                              </button>
                                              <button
                                                type="button"
                                                className={cn(
                                                  "flex items-center gap-2 min-w-0 flex-1 rounded px-1 py-1 hover:bg-muted/50",
                                                  itl2Selected && "bg-muted/50 border-l-2 border-primary"
                                                )}
                                                onClick={(e) => {
                                                  if (e.altKey) {
                                                    const childCodes = Object.values(itl3Map as Record<string, string[]>).flat()
                                                    addRegionCodes([itl2, ...childCodes])
                                                  } else {
                                                    toggleRegionCode(itl2)
                                                  }
                                                }}
                                              >
                                                <Check className={cn("h-4 w-4", itl2Selected ? "opacity-100" : "opacity-0")} />
                                                <span className="font-mono text-xs text-muted-foreground">{itl2}</span>
                                                <span className="truncate text-sm">{regionLabel(itl2)}</span>
                                                <span className="ml-auto text-xs text-muted-foreground">ITL2</span>
                                              </button>
          </div>

                                            {itl2Expanded && (
                                              <div className="mt-1 pl-9 border-l space-y-1 transition-all duration-150 ease-out">
                                                {Object.keys(itl3Map)
                                                  .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
                                                  .map((itl3, itl3Idx) => {
                                                    const lads = itl3Map[itl3] ?? []
                                                    const itl3Expanded = !!openITL3[itl3]
                                                    const itl3Selected = regions.includes(itl3)
                                                    return (
                                                      <div key={itl3} className={cn("rounded px-1 py-1 hover:bg-muted/30", itl3Idx % 2 === 0 && "bg-muted/10")}>
          <div className="flex items-center gap-2">
                                                          <button
                                                            type="button"
                                                            className="h-7 w-7 grid place-items-center rounded hover:bg-muted/50"
                                                            onClick={() => setOpenITL3((m) => ({ ...m, [itl3]: !itl3Expanded }))}
                                                            aria-label={itl3Expanded ? "Collapse" : "Expand"}
                                                          >
                                                            <ChevronRight className={cn("h-4 w-4 transition-transform", itl3Expanded && "rotate-90")} />
                                                          </button>
                                                          <button
                                                            type="button"
                                                            className={cn(
                                                              "flex items-center gap-2 min-w-0 flex-1 rounded px-1 py-1 hover:bg-muted/50",
                                                              itl3Selected && "bg-muted/50 border-l-2 border-primary"
                                                            )}
                                                            onClick={(e) => {
                                                              if (e.altKey) {
                                                                addRegionCodes([itl3, ...(lads as string[])])
                                                              } else {
                                                                toggleRegionCode(itl3)
                                                              }
                                                            }}
                                                          >
                                                            <Check className={cn("h-4 w-4", itl3Selected ? "opacity-100" : "opacity-0")} />
                                                            <span className="font-mono text-xs text-muted-foreground">{itl3}</span>
                                                            <span className="truncate text-sm">{regionLabel(itl3)}</span>
                                                            <span className="ml-auto text-xs text-muted-foreground">ITL3</span>
                                                          </button>
          </div>

                                                        {itl3Expanded && (
                                                          <div className="mt-1 pl-9 border-l space-y-1 transition-all duration-150 ease-out">
                                                            {lads
                                                              .slice()
                                                              .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
                                                              .map((lad, ladIdx) => (
                                                                <LadRow
                                                                  key={lad}
                                                                  lad={lad}
                                                                  selected={regions.includes(lad)}
                                                                  label={regionLabel(lad)}
                                                                  striped={ladIdx % 2 === 0}
                                                                  onToggleCode={toggleRegionCode}
                                                                />
                                                              ))}
        </div>
                                                        )}
                                                      </div>
                                                    )
                                                  })}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    ) : (
                      <div className="p-2">
                        {(() => {
                          const q = regionSearch.trim().toLowerCase()
                          const entries = Object.entries(regionIndex)

                          // Default search mode: if no query, show ITL1 + current selection only (avoid dumping thousands).
                          const base =
                            q.length === 0
                              ? entries.filter(([, v]) => v.level === "ITL1")
                              : entries.filter(([code, v]) => code.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))

                          const filtered = q.length === 0 ? base.slice(0, 60) : base.slice(0, 400)

                          const byLevel = filtered.reduce(
                            (acc, [code, v]) => {
                              acc[v.level] = acc[v.level] ?? []
                              acc[v.level].push([code, v] as const)
                              return acc
                            },
                            {} as Record<string, Array<readonly [string, RegionIndexEntry]>>
                          )
                          const levelOrder = ["ITL1", "ITL2", "ITL3", "LAD"]

                          return (
                            <>
                              {q.length === 0 && regions.length > 0 && (
                                <div className="mb-3">
                                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Selected</div>
                                  <div className="space-y-1">
                                    {regions
                                      .slice()
                                      .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
                                      .slice(0, 50)
                                      .map((code) => (
                                        <button
                                          key={code}
                                          type="button"
                                          className="w-full text-left flex items-center gap-2 rounded px-2 py-2 hover:bg-muted/40 bg-muted/50"
                                          onClick={() => setRegions((cur) => cur.filter((x) => x !== code))}
                                        >
                                          <Check className="h-4 w-4 opacity-100" />
                                          <span className="font-mono text-xs text-muted-foreground">{code}</span>
                                          <span className="truncate flex-1">{regionLabel(code)}</span>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {levelOrder
                                .filter((lvl) => (byLevel[lvl] ?? []).length > 0)
                                .map((lvl) => (
                                  <div key={lvl} className="mb-2">
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{LEVEL_LABEL[lvl]}</div>
                                    <div className="space-y-1">
                                      {(byLevel[lvl] ?? [])
                                        .sort((a, b) => a[1].name.localeCompare(b[1].name))
                                        .map(([code, v]) => {
                                          const selected = regions.includes(code)
                                          return (
              <button
                                              key={code}
                                              type="button"
                                              className={cn(
                                                "w-full text-left flex items-center gap-2 rounded px-2 py-2 hover:bg-muted/40",
                                                selected && "bg-muted/50"
                                              )}
                                              onClick={() =>
                                                setRegions((cur) => (selected ? cur.filter((x) => x !== code) : [...cur, code]))
                                              }
                                            >
                                              <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                              <span className="font-mono text-xs text-muted-foreground">{code}</span>
                                              <span className="truncate flex-1">{v.name}</span>
                                              <span className="text-xs text-muted-foreground">{LEVEL_LABEL[lvl]}</span>
              </button>
                                          )
                                        })}
                                    </div>
                                  </div>
          ))}

                              {q.length === 0 && (
                                <div className="px-2 pt-2 text-xs text-muted-foreground">
                                  Tip: type to search ITL2/ITL3/LAD.
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
        </div>

                  <div className="flex items-center justify-between">
                    {regionMode === "browse" ? (
                      <div className="text-xs text-muted-foreground">Tip: ⌥-click selects all children.</div>
                    ) : regionSearch.trim() ? (
                      <div className="text-xs text-muted-foreground">Search results are capped for speed.</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Search is the primary mode; hierarchy is optional.</div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setRegions([])}
                      disabled={!regions.length}
                    >
                      Clear
                    </Button>
                  </div>
                  </div>
                )}
              </details>
            </div>

            {/* Time period */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-2">
              <details open={yearsOpen} onToggle={(e) => setYearsOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div className="text-sm font-medium">Time period</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{selectedYears.length ? `${selectedYears.length} selected` : "None selected"}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", yearsOpen && "rotate-180")} />
                  </div>
                </summary>

                {!yearsOpen && (
                  <div className="mt-2">
                    <MultiSelectChips
                      values={selectedYears.slice().sort((a, b) => a - b).map(String)}
                      getLabel={(v) => v}
                      onRemove={(v) => setSelectedYears((cur) => cur.filter((y) => y !== Number(v)))}
                    />
                  </div>
                )}

                {yearsOpen && (
                  <div className="mt-2 space-y-2">
                    <Command className="border rounded-md bg-background">
                      <CommandInput placeholder="Search years…" />
                      <CommandList className="max-h-[260px]">
                        <CommandEmpty>No years found.</CommandEmpty>
                        <CommandGroup heading="Years">
                          {availableYears.map((y) => {
                            const selected = selectedYears.includes(y)
                            return (
                              <CommandItem
                                key={y}
                                value={String(y)}
                                onSelect={() =>
                                  setSelectedYears((cur) =>
                                    selected ? cur.filter((x) => x !== y) : [...cur, y]
                                  )
                                }
                              >
                                <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                <span className="font-mono">{y}</span>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div className="flex items-center justify-between">
                      {selectedYears.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Select at least one year.</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{selectedYears.length} selected</div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          if (!availableYears.length) return
                          const allSelected = selectedYears.length === availableYears.length
                          setSelectedYears(allSelected ? [] : availableYears)
                        }}
                        disabled={!availableYears.length}
                      >
                        {selectedYears.length === availableYears.length ? "Clear all" : "Select all"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setSelectedYears([])}
                        disabled={!selectedYears.length}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </details>
            </div>

            {/* Scenario */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-2">
              <details
                open={scenarioOpen}
                onToggle={(e) => setScenarioOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <div className="text-sm font-medium">Scenario</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{scenarioSummary}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", scenarioOpen && "rotate-180")} />
                  </div>
                </summary>

                {!scenarioOpen && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Selected: <span className="font-mono">{scenarioSummary}</span>
                  </div>
                )}

                {scenarioOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Scenario</div>
                      <div className="flex flex-wrap gap-2">
                        {(["baseline", "upside", "downside"] as Scenario[]).map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant={localScenario === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLocalScenario(s)}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </details>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {/* Preview (matches export sheets) */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Preview</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {previewTab === "data" ? `${previewDataRows.length} / ${canonicalRows.length} rows` : previewTab === "info" ? `${previewInfoRows.length} items` : "Time series"}
              </Badge>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-10 w-full bg-muted/30 rounded-md animate-pulse" />
              <div className="h-10 w-full bg-muted/30 rounded-md animate-pulse" />
              <div className="h-10 w-full bg-muted/30 rounded-md animate-pulse" />
            </div>
          ) : (
            <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="timeseries">Time Series</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <div className="overflow-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 whitespace-nowrap">Item</th>
                        <th className="text-left p-2 whitespace-nowrap">Value</th>
              </tr>
            </thead>
            <tbody>
                      {previewInfoRows.length ? (
                        previewInfoRows.map((r: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 whitespace-nowrap">{r.Item}</td>
                            <td className="p-2">
                              <div className="truncate max-w-[780px]">{r.Value}</div>
                  </td>
                </tr>
                        ))
                      ) : (
                <tr>
                          <td className="p-2 text-muted-foreground" colSpan={2}>
                            No info.
                  </td>
                </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="data" className="mt-4">
                <div className="overflow-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                <tr>
                        <th className="text-left p-2 whitespace-nowrap">Metric</th>
                        <th className="text-left p-2 whitespace-nowrap">Region</th>
                        <th className="text-left p-2 whitespace-nowrap">Region Code</th>
                        <th className="text-right p-2 whitespace-nowrap">Year</th>
                        <th className="text-left p-2 whitespace-nowrap">Scenario</th>
                        <th className="text-right p-2 whitespace-nowrap">Value</th>
                        <th className="text-left p-2 whitespace-nowrap">Units</th>
                        <th className="text-left p-2 whitespace-nowrap">Data Type</th>
                        <th className="text-left p-2 whitespace-nowrap">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewDataRows.length ? (
                        previewDataRows.map((r: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 whitespace-nowrap">{r.Metric}</td>
                            <td className="p-2 whitespace-nowrap">{r.Region}</td>
                            <td className="p-2 whitespace-nowrap font-mono text-xs">{r["Region Code"]}</td>
                            <td className="p-2 whitespace-nowrap text-right font-mono">{r.Year}</td>
                            <td className="p-2 whitespace-nowrap">{r.Scenario}</td>
                            <td className="p-2 whitespace-nowrap text-right font-mono">
                              {formatDisplay(typeof r.Value === "number" ? r.Value : null, r.Units ?? unit)}
                  </td>
                            <td className="p-2 whitespace-nowrap">{r.Units ?? ""}</td>
                            <td className="p-2 whitespace-nowrap">{r["Data Type"] ?? ""}</td>
                            <td className="p-2 whitespace-nowrap">{r.Source ?? ""}</td>
                </tr>
                        ))
              ) : (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={9}>
                            No data.
                    </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
              </TabsContent>

              <TabsContent value="timeseries" className="mt-4">
                <div className="overflow-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {previewTimeSeries.header.map((h) => (
                          <th key={h} className="text-left p-2 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTimeSeries.rows.map((r: any, i: number) => (
                        <tr key={i} className="border-t">
                          {previewTimeSeries.header.map((h) => (
                            <td key={h} className={cn("p-2 whitespace-nowrap", h !== "Scenario \\ Year" && "text-right font-mono")}>
                              {h === "Scenario \\ Year" ? r[h] : r[h] == null ? "—" : formatDisplay(Number(r[h]), unit)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* API (secondary) */}
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">API</summary>
          <div className="mt-4 space-y-4">
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Schema</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copy(schemaUrl)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </Button>
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">{schemaUrl}</div>
              {schema ? (
                <details className="rounded-md bg-muted/30 p-3">
                  <summary className="cursor-pointer text-xs font-medium">View schema JSON</summary>
                  <div className="mt-2">
                    <JsonTree value={schema} />
                  </div>
                </details>
              ) : (
                <div className="text-sm text-muted-foreground">Schema will appear when authenticated.</div>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Request</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copy(dataUrl)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copy(JSON.stringify(requestBody, null, 2))}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">{dataUrl}</div>
              <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-auto max-h-[220px]">
                {JSON.stringify(requestBody, null, 2)}
              </pre>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Response (JSON)</div>
              {!result ? <div className="text-sm text-muted-foreground">No data.</div> : <JsonTree value={result} />}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}


