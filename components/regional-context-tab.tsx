"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MapScaffold } from "@/components/map-scaffold"
import { REGIONS, type Metric, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, calculateChange, formatValue, formatPercentage, type DataPoint } from "@/lib/data-service"
import type { RegionMetadata } from "@/components/region-search"
import { getITL1ForLad, getITL1ForITL2, getITL1ForITL3, getLadsForITL1 } from "@/lib/itl-to-lad"
import { getMapColorForValue, type MapType } from "@/lib/map-color-scale"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type RegionLevel = "ITL1" | "ITL2" | "ITL3" | "LAD"
type MapMode = "value" | "growth"

type Role = "current" | "parent" | "national" | "peer"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function pp(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : ""
  return `${sign}${Math.abs(n).toFixed(1)}pp`
}

function pickPoint(series: DataPoint[], year: number) {
  const current = series.find((d) => d.year === year)
  const prev = series.find((d) => d.year === year - 1)
  const value = current?.value ?? null
  const prevValue = prev?.value ?? null
  const growth = value != null && prevValue != null ? calculateChange(value, prevValue) : null
  const type = current?.type ?? null
  return { value, prevValue, growth, type }
}

function choosePeers(exclude: Set<string>, count: number): string[] {
  // Peers disabled for now (explicit user feedback: "East Midlands not useful").
  // Keep helper to preserve call-sites and make it easy to re-enable later.
  void exclude
  void count
  return []
}

export function RegionalContextTab({
  metric,
  region,
  year,
  scenario,
  selectedRegionMetadata,
}: {
  metric: Metric
  region: string
  year: number
  scenario: Scenario
  selectedRegionMetadata?: RegionMetadata | null
}) {
  const regionCfg = useMemo(() => REGIONS.find((r) => r.code === region), [region])
  const focalLevel = (regionCfg?.level ?? "ITL1") as RegionLevel

  const parentITL1 = useMemo(() => {
    if (focalLevel === "LAD") return getITL1ForLad(region)
    if (focalLevel === "ITL2") return getITL1ForITL2(region)
    if (focalLevel === "ITL3") return getITL1ForITL3(region)
    return regionCfg?.level === "ITL1" ? regionCfg.code : null
  }, [focalLevel, region, regionCfg?.code, regionCfg?.level])

  const parentCfg = useMemo(() => (parentITL1 ? REGIONS.find((r) => r.code === parentITL1) : null), [parentITL1])

  // Within-parent LAD universe (LAD -> ITL1)
  const maskLadCodes = useMemo(() => {
    if (!parentITL1) return []
    return getLadsForITL1(parentITL1)
  }, [parentITL1])

  const [mapMode, setMapMode] = useState<MapMode>("growth")
  const [growthPeriod, setGrowthPeriod] = useState(1) // default YoY

  // Mirror map color semantics used by the main dashboard map (FullWidthMap + MapOverlaysDynamic)
  const mapType: MapType = useMemo(() => {
    if (mapMode === "value") return "level"
    const canDeclineMetrics = [
      "population_total",
      "population_16_64",
      "emp_total_jobs",
      "employment_rate_pct",
      "unemployment_rate_pct",
    ]
    return canDeclineMetrics.includes(metric.id) ? "growth" : "level"
  }, [mapMode, metric.id])

  const rampColors = useMemo(() => {
    if (mapType === "level") {
      return [
        getMapColorForValue({ mapType: "level", value: 0, domain: [0, 100] }),
        getMapColorForValue({ mapType: "level", value: 25, domain: [0, 100] }),
        getMapColorForValue({ mapType: "level", value: 50, domain: [0, 100] }),
        getMapColorForValue({ mapType: "level", value: 75, domain: [0, 100] }),
        getMapColorForValue({ mapType: "level", value: 100, domain: [0, 100] }),
      ]
    }
    return [
      getMapColorForValue({ mapType: "growth", value: -50, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: -25, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: -10, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: 0, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: 10, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: 25, domain: [-50, 50], midpoint: 0 }),
      getMapColorForValue({ mapType: "growth", value: 50, domain: [-50, 50], midpoint: 0 }),
    ]
  }, [mapType])

  // Region index for parent bbox focus
  const [regionIndex, setRegionIndex] = useState<Record<string, Omit<RegionMetadata, "code">> | null>(null)
  useEffect(() => {
    fetch("/processed/region-index.json")
      .then((r) => r.json())
      .then((d) => setRegionIndex(d))
      .catch(() => setRegionIndex(null))
  }, [])

  const parentFocusMetadata: RegionMetadata | null = useMemo(() => {
    if (!parentITL1 || !regionIndex?.[parentITL1]) return null
    const md = regionIndex[parentITL1]
    return { code: parentITL1, name: md.name, level: md.level, bbox: md.bbox }
  }, [parentITL1, regionIndex])

  // Build comparison set (max 6): current, parent (ITL1), national, peers
  const [comparisonSet, setComparisonSet] = useState<
    Array<{ code: string; name: string; level: string; role: Role; value: number | null; growth: number | null }>
  >([])
  const [loading, setLoading] = useState(true)
  const [showExplain, setShowExplain] = useState(false)

  const focalRow = useMemo(() => comparisonSet.find((r) => r.role === "current") ?? null, [comparisonSet])
  const parentRow = useMemo(() => comparisonSet.find((r) => r.role === "parent") ?? null, [comparisonSet])
  const ukRow = useMemo(() => comparisonSet.find((r) => r.role === "national") ?? null, [comparisonSet])

  const valueDeltaVsParent = useMemo(() => {
    if (!focalRow || !parentRow) return null
    if (focalRow.value == null || parentRow.value == null) return null
    return focalRow.value - parentRow.value
  }, [focalRow, parentRow])

  const valueDeltaVsUK = useMemo(() => {
    if (!focalRow || !ukRow) return null
    if (focalRow.value == null || ukRow.value == null) return null
    return focalRow.value - ukRow.value
  }, [focalRow, ukRow])

  const yoyDeltaVsParent = useMemo(() => {
    if (!focalRow || !parentRow) return null
    if (focalRow.growth == null || parentRow.growth == null) return null
    return focalRow.growth - parentRow.growth
  }, [focalRow, parentRow])

  const yoyDeltaVsUK = useMemo(() => {
    if (!focalRow || !ukRow) return null
    if (focalRow.growth == null || ukRow.growth == null) return null
    return focalRow.growth - ukRow.growth
  }, [focalRow, ukRow])

  const gaugePct = useMemo(() => {
    // Visually map delta (pp) into a stable range so it remains readable across metrics.
    // ±2pp is a good default for a compact gauge; clamp prevents extreme values from pinning hard.
    if (yoyDeltaVsParent == null) return 50
    const capped = clamp(yoyDeltaVsParent, -2, 2)
    return ((capped + 2) / 4) * 100
  }, [yoyDeltaVsParent])

  const parentLabel = parentCfg?.name ?? "parent region"

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    const isAbort = (err: unknown) =>
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && "name" in err && (err as any).name === "AbortError")

    const safeFetchJson = async (url: string, init: RequestInit) => {
      try {
        const res = await fetch(url, init)
        return await res.json()
      } catch (err) {
        if (isAbort(err)) return null
        throw err
      }
    }

    ;(async () => {
      setLoading(true)
      try {
        const focalName = regionCfg?.name ?? region
        const parentName = parentCfg?.name ?? parentITL1 ?? ""

        const exclude = new Set<string>([region, parentITL1 ?? ""])
        const peers = choosePeers(exclude, 0)

        const [focalSeries, parentSeries] = await Promise.all([
          fetchSeries({ metricId: metric.id, region, scenario }),
          parentITL1 ? fetchSeries({ metricId: metric.id, region: parentITL1, scenario }) : Promise.resolve([]),
        ])

        const focalPoint = pickPoint(focalSeries, year)
        const parentPoint = pickPoint(parentSeries, year)

        // National benchmark (avg across ITL1)
        const natResp = await safeFetchJson("/api/national-metric", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ metricId: metric.id, year, scenario }),
          signal: ac.signal,
        })
        if (cancelled || ac.signal.aborted) return

        const nationalValue = (natResp?.value ?? null) as number | null
        const nationalGrowth = (natResp?.growth ?? null) as number | null

        const rows: Array<{
          code: string
          name: string
          level: string
          role: Role
          value: number | null
          growth: number | null
        }> = [
          { code: region, name: focalName, level: focalLevel, role: "current", value: focalPoint.value, growth: focalPoint.growth },
        ]

        if (parentITL1) {
          rows.push({
            code: parentITL1,
            name: parentName,
            level: "ITL1",
            role: "parent",
            value: parentPoint.value,
            growth: parentPoint.growth,
          })
        }

        rows.push({
          code: "UK",
          name: "United Kingdom",
          level: "National",
          role: "national",
          value: nationalValue,
          growth: nationalGrowth,
        })

        // no peers

        if (cancelled) return
        setComparisonSet(rows)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [metric.id, metric.title, metric.unit, region, regionCfg?.name, focalLevel, parentITL1, parentCfg?.name, year, scenario])

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>Regional context</CardTitle>
              <CardDescription>
                A within-parent snapshot view for quick decision context.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary">{metric.shortTitle}</Badge>
              {parentCfg?.name ? (
                <Badge variant="outline">Parent: {parentCfg.name}</Badge>
              ) : parentITL1 ? (
                <Badge variant="outline">Parent: {parentITL1}</Badge>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExplain((v) => !v)}
                className="h-8"
              >
                {showExplain ? "Hide" : "Explain this view"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showExplain && (
          <CardContent className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <div>
              This tab answers how the selected place is performing within its parent region, anchored to the United
              Kingdom benchmark.
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Map</span>: colours show the selected metric as a snapshot for the chosen
                year. The pink outline is the selected area; the blue outline is the parent boundary. Areas outside the
                parent are de-emphasised.
              </div>
              <div>
                <span className="font-medium">Key takeaways</span>: the right-hand card turns the view into decisions —
                gaps vs the parent and vs the UK, plus a simple momentum gauge.
              </div>
              <div>
                <span className="font-medium">Snapshot year</span>: use the year control to switch the map + comparisons
                to planning horizons (e.g. 2026/2030/2035).
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Within-parent map</CardTitle>
            <CardDescription>
              {parentCfg?.name
                ? `LADs within ${parentCfg.name} • ${mapMode === "growth" ? "Year-on-Year change" : "absolute value"}`
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mapMode === "growth" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapMode("growth")}
              >
                Growth (Year-on-Year)
              </Button>
              <Button
                variant={mapMode === "value" ? "default" : "outline"}
                size="sm"
                onClick={() => setMapMode("value")}
              >
                Absolute value
              </Button>
              {mapMode === "growth" && (
                <Badge variant="outline" className="ml-2">
                  Period: {growthPeriod === 1 ? "Year-on-Year" : `${growthPeriod}y`}
                </Badge>
              )}
            </div>

            <div className="h-[520px]">
              <MapScaffold
                selectedRegion={region}
                selectedRegionMetadata={selectedRegionMetadata}
                focusRegionMetadata={parentFocusMetadata}
                metric={metric.id}
                year={year}
                scenario={scenario}
                level="LAD"
                mapMode={mapMode}
                growthPeriod={growthPeriod}
                onMapModeChange={setMapMode}
                onGrowthPeriodChange={setGrowthPeriod}
                showRegionInfo={false}
                hideHeader={true}
                mapId="regional-map"
                maskRegionCodes={maskLadCodes}
                parentOutline={parentITL1 ? { level: "ITL1", code: parentITL1 } : null}
              />
            </div>

            {/* Scale (copied from FullWidthMap pattern) */}
            <div className="border-t pt-3">
              <div className="space-y-1.5">
                <h5 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Scale</h5>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
                    {rampColors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  {mapMode === "growth" ? (
                    mapType === "growth" ? (
                      <>
                        <span>Weaker</span>
                        <span>0%</span>
                        <span>Stronger</span>
                      </>
                    ) : (
                      <>
                        <span>Lower</span>
                        <span>Higher</span>
                      </>
                    )
                  ) : (
                    <>
                      <span>Lower</span>
                      <span>Higher</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Outlined: selected area (pink) and parent boundary (blue). Colours show{" "}
                  {mapMode === "growth" ? "Year-on-Year change" : "absolute value"}.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparison set</CardTitle>
            <CardDescription>Role-driven (not a league table)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key takeaways (visual) */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Key takeaways</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Year-on-Year
                  </Badge>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Momentum vs {parentLabel}: </span>
                <span className={cn(yoyDeltaVsParent == null ? "text-muted-foreground" : "font-semibold")}>
                  {yoyDeltaVsParent == null ? "—" : yoyDeltaVsParent >= 0 ? "Above" : "Below"}
                </span>
                <span className="text-muted-foreground"> • vs United Kingdom: </span>
                <span className={cn(yoyDeltaVsUK == null ? "text-muted-foreground" : "font-semibold")}>
                  {yoyDeltaVsUK == null ? "—" : yoyDeltaVsUK >= 0 ? "Above" : "Below"}
                </span>
              </div>

              {/* Delta scoreboard */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Value gap</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">vs {parentLabel}</span>
                      <span className="text-sm font-semibold">
                        {valueDeltaVsParent == null ? "—" : formatValue(valueDeltaVsParent, metric.unit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">vs United Kingdom</span>
                      <span className="text-sm font-semibold">
                        {valueDeltaVsUK == null ? "—" : formatValue(valueDeltaVsUK, metric.unit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Year-on-Year gap</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">vs {parentLabel}</span>
                      <span
                        className={cn(
                          "text-sm font-semibold inline-flex items-center gap-1",
                          yoyDeltaVsParent == null
                            ? "text-muted-foreground"
                            : yoyDeltaVsParent >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {yoyDeltaVsParent == null ? (
                          <>
                            <Minus className="h-4 w-4" /> —
                          </>
                        ) : yoyDeltaVsParent >= 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4" /> {pp(yoyDeltaVsParent)}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4" /> {pp(yoyDeltaVsParent)}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">vs United Kingdom</span>
                      <span
                        className={cn(
                          "text-sm font-semibold inline-flex items-center gap-1",
                          yoyDeltaVsUK == null
                            ? "text-muted-foreground"
                            : yoyDeltaVsUK >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {yoyDeltaVsUK == null ? (
                          <>
                            <Minus className="h-4 w-4" /> —
                          </>
                        ) : yoyDeltaVsUK >= 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4" /> {pp(yoyDeltaVsUK)}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-4 w-4" /> {pp(yoyDeltaVsUK)}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simple gauge (YoY vs parent) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Underperforming</span>
                  <span>In line</span>
                  <span>Outperforming</span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-orange-300/70 via-muted to-blue-400/70 dark:from-orange-600/50 dark:via-muted dark:to-blue-500/50">
                  {/* Midpoint marker */}
                  <div className="absolute left-1/2 top-0 h-full w-[2px] bg-background/80" />
                  {/* Focal marker */}
                  <div
                    className="absolute top-[-3px] h-[18px] w-[6px] rounded-full bg-foreground"
                    style={{ left: `calc(${gaugePct}% - 3px)` }}
                    title={
                      yoyDeltaVsParent == null
                        ? "No Year-on-Year gap available"
                        : `Year-on-Year gap vs ${parentLabel}: ${pp(yoyDeltaVsParent)}`
                    }
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {yoyDeltaVsParent == null
                    ? `Year-on-Year gap vs ${parentLabel}: —`
                    : `Year-on-Year gap vs ${parentLabel}: ${pp(yoyDeltaVsParent)}`}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {comparisonSet.map((r) => (
                  <div
                    key={`${r.role}-${r.code}`}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.role === "current" ? "default" : r.role === "parent" ? "secondary" : "outline"}>
                          {r.role}
                        </Badge>
                        <div className="font-medium truncate">{r.name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.value == null ? "—" : `${formatValue(r.value, metric.unit)} • ${year}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {r.growth == null ? "—" : formatPercentage(r.growth)}
                      </div>
                      <div className="text-xs text-muted-foreground">Year-on-Year</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


