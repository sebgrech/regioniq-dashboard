"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Briefcase,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  FileBarChart2,
  MessageSquare,
  PlusSquare,
  RefreshCw,
  Home,
  LayoutGrid,
  MapPinned,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DtreFullWidthMap } from "@/components/dtre/DtreFullWidthMap"
import { DTRE_MAP_METRICS } from "@/components/dtre/dtre-map-config"
import { GPComparisonSection } from "@/components/gp-comparison-section"
import { METRICS, SCENARIOS, type Scenario } from "@/lib/metrics.config"
import {
  calculateChange,
  fetchSeries,
  formatPercentage,
  formatValue,
  type DataPoint,
} from "@/lib/data-service"
import { getSearchParam, getSearchParamNumber, updateSearchParams } from "@/lib/utils"
import type { RegionMetadata } from "@/components/region-search"

type WorkspaceTab =
  | "home"
  | "export-live"
  | "research-report"
  | "big-box-report"
  | "investment-comps"
  | "lease-comps"
  | "economic-profile"
  | "asset-viewer"
  | "update-live"
  | "create-new"
  | "feedback"
type DataSource = "real" | "mock"

interface EconomicProfileShellProps {
  slug: string
}

const CORE_METRIC_IDS = ["population_total", "nominal_gva_mn_gbp", "gdhi_per_head_gbp", "emp_total_jobs"] as const

const LEFT_SIDEBAR_ITEMS: Array<{
  id: WorkspaceTab
  label: string
  icon: typeof Home
}> = [
  { id: "home", label: "Home", icon: Home },
  { id: "export-live", label: "Export Data (Live!)", icon: Download },
  { id: "research-report", label: "Research Report", icon: FileBarChart2 },
  { id: "big-box-report", label: "Big Box Report", icon: Warehouse },
  { id: "economic-profile", label: "Economic Profile", icon: MapPinned },
  { id: "investment-comps", label: "Investment Comps", icon: LayoutGrid },
  { id: "lease-comps", label: "Lease Comps", icon: Briefcase },
  { id: "asset-viewer", label: "Asset Viewer", icon: FileSpreadsheet },
  { id: "update-live", label: "Update Data (Live!)", icon: RefreshCw },
  { id: "create-new", label: "Create New", icon: PlusSquare },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
]

const MOCK_FILTERS = [
  "Cap Rate",
  "Purchaser",
  "Vendor",
  "Occupier",
  "Portfolio",
  "Building Spec",
  "Use & Sub-use",
  "Country & Region",
]

const LOGISTICS_POSITIONING_BULLETS: Array<{
  id: string
  text: string
  Icon: typeof Target
}> = [
  {
    id: "hiring_constraints",
    text: "Hiring is constrained for new occupiers",
    Icon: Users,
  },
  {
    id: "office_absorption",
    text: "Office absorption trails GVA growth",
    Icon: TrendingUp,
  },
  {
    id: "stable_local_demand",
    text: "Stable local demand with no acute growth pressures",
    Icon: Briefcase,
  },
]

function toSeed(region: string, year: number, metric: string): number {
  return `${region}:${year}:${metric}`.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function buildMockSeries(metricId: string, region: string): DataPoint[] {
  const base = toSeed(region, 2024, metricId)
  const points: DataPoint[] = []
  for (let year = 2010; year <= 2050; year += 1) {
    const historical = year <= 2023
    const wave = Math.sin((year - 2010) / 4 + base / 100)
    const trend = (year - 2010) * (metricId.includes("gdhi") ? 120 : metricId.includes("gva") ? 400 : 55)
    const floor = metricId.includes("population")
      ? 900000
      : metricId.includes("gva")
        ? 55000
        : metricId.includes("gdhi")
          ? 24000
          : 350000
    points.push({
      year,
      value: Math.max(1000, floor + trend + wave * floor * 0.03),
      type: historical ? "historical" : "forecast",
      data_quality: historical ? "interpolated" : null,
    })
  }
  return points
}

function MockBars({ seed, bars = 8 }: { seed: number; bars?: number }) {
  return (
    <div className="flex h-28 items-end gap-1 rounded border border-[#d7e3ef] bg-[#f8fcff] p-2">
      {Array.from({ length: bars }, (_, idx) => {
        const value = 22 + ((seed + idx * 19) % 72)
        return (
          <div key={idx} className="flex-1 rounded-sm bg-[#8bd4ee]/80" style={{ height: `${value}%` }} />
        )
      })}
    </div>
  )
}

function MockLines({ seed }: { seed: number }) {
  return (
    <div className="rounded border border-[#d7e3ef] bg-[#f8fcff] p-3">
      <div className="relative h-24 overflow-hidden rounded bg-white/70">
        <svg className="h-full w-full" viewBox="0 0 300 100" preserveAspectRatio="none">
          <path
            d={`M0 ${55 + (seed % 10)} C40 20, 80 70, 120 45 C170 15, 220 80, 300 ${35 + (seed % 20)}`}
            fill="none"
            stroke="#28a8d8"
            strokeWidth="3"
          />
          <path
            d={`M0 ${68 + (seed % 8)} C40 50, 90 85, 150 60 C210 30, 250 80, 300 ${50 + (seed % 10)}`}
            fill="none"
            stroke="#9adff3"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        </svg>
      </div>
    </div>
  )
}

function MockSection({
  title,
  subtitle,
  seed,
}: {
  title: string
  subtitle: string
  seed: number
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#d7dee7] bg-white p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-[#5f7690]">{subtitle}</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {["Volume", "Value", "Velocity"].map((kpi, idx) => (
            <div key={kpi} className="rounded-lg border border-[#d7e3ef] bg-[#f8fcff] p-3">
              <div className="text-[11px] text-[#68819a]">{kpi}</div>
              <div className="mt-1 text-lg font-semibold">£{(seed + idx * 37).toLocaleString()}M</div>
              <div className="mt-1 text-[11px] text-[#6e8aa2] blur-[0.8px]">Prefilled internal benchmark</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#d7dee7] bg-white p-4">
          <div className="mb-2 text-sm font-medium">Trend Overview</div>
          <MockLines seed={seed} />
        </div>
        <div className="rounded-xl border border-[#d7dee7] bg-white p-4">
          <div className="mb-2 text-sm font-medium">Distribution</div>
          <MockBars seed={seed} bars={10} />
        </div>
      </div>

      <div className="rounded-xl border border-[#d7dee7] bg-white p-4">
        <div className="mb-3 text-sm font-medium">Context Table (Mocked)</div>
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[2fr_1fr_1fr] gap-2 rounded border border-[#dce6f1] bg-[#f9fcff] p-2 text-[11px]"
            >
              <div className="text-[#3b536b]">Record {idx + 1}</div>
              <div className="text-[#46657f] blur-[0.9px]">Confidential</div>
              <div className="text-[#46657f] blur-[0.9px]">Restricted</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function EconomicProfileShell({ slug: _slug }: EconomicProfileShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const region = getSearchParam(searchParams, "region", "UKI")
  const year = getSearchParamNumber(searchParams, "year", 2026)
  const scenarioParam = getSearchParam(searchParams, "scenario", "baseline")
  const scenario = SCENARIOS.includes(scenarioParam as Scenario) ? (scenarioParam as Scenario) : "baseline"
  const mapMetricParam = getSearchParam(searchParams, "mapMetric", "nominal_gva_mn_gbp")
  const mapMetric = DTRE_MAP_METRICS.some((metric) => metric.id === mapMetricParam)
    ? mapMetricParam
    : "nominal_gva_mn_gbp"

  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>("economic-profile")
  const [logoLoadError, setLogoLoadError] = useState(false)
  const [selectedRegionMetadata, setSelectedRegionMetadata] = useState<RegionMetadata | null>(null)
  const [regionIndex, setRegionIndex] = useState<Record<string, Omit<RegionMetadata, "code">> | null>(null)
  const [allMetricsSeriesData, setAllMetricsSeriesData] = useState<
    {
      metricId: string
      data: DataPoint[]
      source: DataSource
    }[]
  >([])

  useEffect(() => {
    fetch("/processed/region-index.json")
      .then((res) => res.json())
      .then((data) => setRegionIndex(data))
      .catch(() => setRegionIndex(null))
  }, [])

  useEffect(() => {
    if (!regionIndex || !region) return
    const metadata = regionIndex[region]
    if (!metadata) return
    setSelectedRegionMetadata({
      code: region,
      name: metadata.name,
      level: metadata.level,
      bbox: metadata.bbox,
    })
  }, [region, regionIndex])

  const metricIdsToFetch = useMemo(
    () => Array.from(new Set([...CORE_METRIC_IDS, mapMetric])),
    [mapMetric]
  )

  useEffect(() => {
    let isCancelled = false

    ;(async () => {
      const data = await Promise.all(
        metricIdsToFetch.map(async (metricId) => {
          try {
            const realData = await fetchSeries({ metricId, region, scenario })
            if (realData.length > 0) {
              return { metricId, data: realData, source: "real" as const }
            }
          } catch {
            // Fallback to deterministic mock sequence for demo resilience.
          }
          return {
            metricId,
            data: buildMockSeries(metricId, region),
            source: "mock" as const,
          }
        })
      )
      if (!isCancelled) {
        setAllMetricsSeriesData(data)
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [metricIdsToFetch, region, scenario])

  const updateURL = (updates: Record<string, string | number | null | undefined>) => {
    const nextParams = updateSearchParams(searchParams, updates)
    router.replace(`?${nextParams}`, { scroll: false })
  }

  useEffect(() => {
    if (mapMetricParam !== mapMetric) {
      updateURL({ mapMetric })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMetricParam, mapMetric])

  const handleYearChange = (nextYear: number) => updateURL({ year: nextYear })
  const handleScenarioChange = (nextScenario: Scenario) => updateURL({ scenario: nextScenario })
  const handleMapMetricChange = (metricId: string) => updateURL({ mapMetric: metricId })

  const handleRegionChange = (metadata: RegionMetadata) => {
    setSelectedRegionMetadata(metadata)
    updateURL({ region: metadata.code })
  }

  const allMetricsData = useMemo(
    () =>
      allMetricsSeriesData.map((entry) => ({
        metricId: entry.metricId,
        value: entry.data.find((point) => point.year === year)?.value ?? 0,
      })),
    [allMetricsSeriesData, year]
  )

  const selectedMetricSeries = allMetricsSeriesData.find((d) => d.metricId === mapMetric)?.data ?? []
  const currentMetricValue = selectedMetricSeries.find((d) => d.year === year)?.value ?? null
  const previousMetricValue = selectedMetricSeries.find((d) => d.year === year - 1)?.value ?? null
  const yoy =
    currentMetricValue !== null && previousMetricValue !== null
      ? calculateChange(currentMetricValue, previousMetricValue)
      : null

  const particles = useMemo(() => {
    const seed = toSeed(region, year, mapMetric)
    const classes = [
      "animate-particle-float-1",
      "animate-particle-float-2",
      "animate-particle-float-3",
      "animate-particle-float-4",
      "animate-particle-float-5",
      "animate-particle-float-6",
    ]
    return Array.from({ length: 14 }, (_, idx) => {
      const localSeed = seed + idx * 29
      return {
        size: 4 + (localSeed % 10),
        left: (localSeed * 7) % 85,
        top: 10 + ((localSeed * 11) % 72),
        opacity: 0.25 + ((localSeed % 50) / 100),
        className: classes[idx % classes.length],
      }
    })
  }, [mapMetric, region, year])

  const dataQuality = allMetricsSeriesData.every((m) => m.source === "real")
    ? "Live Supabase"
    : allMetricsSeriesData.some((m) => m.source === "real")
      ? "Hybrid (Real + Mock Context)"
      : "Demo Fallback"

  const activeWorkspaceLabel = LEFT_SIDEBAR_ITEMS.find((item) => item.id === activeWorkspace)?.label ?? "Economic Profile"
  const workspaceSeed = toSeed(region, year, activeWorkspace)
  const activeRegionName = selectedRegionMetadata?.name ?? region
  const kpiMetrics = CORE_METRIC_IDS.map((metricId) => {
    const metric = METRICS.find((m) => m.id === metricId)
    const series = allMetricsSeriesData.find((m) => m.metricId === metricId)?.data ?? []
    const current = series.find((d) => d.year === year)?.value ?? 0
    const previous = series.find((d) => d.year === year - 1)?.value ?? 0
    const change = previous > 0 ? calculateChange(current, previous) : null
    return {
      metricId,
      title: metric?.shortTitle ?? metricId,
      valueText: formatValue(current, metric?.unit ?? "", metric?.decimals ?? 0),
      yoyText: change === null ? "n/a" : `${formatPercentage(change)} YoY`,
      yoyClass:
        change === null
          ? "text-[#6b7f94]"
          : change >= 0
            ? "text-emerald-600"
            : "text-red-600",
    }
  })
  const floatingInsightPanel = (
    <div className="rounded-2xl bg-white/45 backdrop-blur-sm p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)]">
      <div className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#233a54]">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#dbeafe] text-[#1d4ed8]">
          <Sparkles className="h-4 w-4" />
        </span>
        <span>Economic Insight</span>
      </div>

      <div className="relative mt-3 rounded-2xl bg-gradient-to-br from-[#f8fcff]/80 to-[#f7f2ff]/80 p-3">
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((particle, idx) => (
            <span
              key={`condensed-particle-${region}-${year}-${idx}`}
              className={`absolute rounded-full ${particle.className}`}
              style={{
                width: `${Math.max(3, particle.size - 2)}px`,
                height: `${Math.max(3, particle.size - 2)}px`,
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                opacity: particle.opacity * 0.6,
                background: "rgba(29, 78, 216, 0.45)",
              }}
            />
          ))}
        </div>

        <div className="relative space-y-2">
          <div className="rounded-xl bg-white/75 p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <GPComparisonSection
              regionCode={region}
              regionName={activeRegionName}
              year={year}
              scenario={scenario}
              assetClass="industrial"
              mainColor="#1d4ed8"
              peerColors={["#08a8d8", "#6ea3c8"]}
            />
          </div>

          <div className="relative overflow-visible rounded-xl border border-[#1d4ed8]/20 bg-gradient-to-br from-[#1d4ed8]/10 via-[#93c5fd]/20 to-transparent">
            <div
              className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 animate-pulse"
              style={{ background: "radial-gradient(circle, rgba(29,78,216,0.35) 0%, transparent 70%)" }}
            />

            <div className="relative p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#1d4ed8]/15 flex items-center justify-center animate-in zoom-in-95 duration-500">
                  <Target className="h-5 w-5 text-[#1d4ed8]" />
                </div>
                <div className="animate-in fade-in-0 slide-in-from-left-3 duration-500">
                  <p className="text-sm font-semibold text-foreground">Key datapoints for positioning</p>
                  <p className="text-xs text-muted-foreground">Logistics</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {LOGISTICS_POSITIONING_BULLETS.map((bullet, index) => {
                  const Icon = bullet.Icon
                  return (
                    <div
                      key={bullet.id}
                      className="group relative flex items-start gap-4 p-3 rounded-lg bg-background/50 border border-border/30 hover:border-[#1d4ed8]/30 hover:bg-background/80 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-3 cursor-default"
                      style={{ animationDelay: `${200 + index * 120}ms`, animationFillMode: "backwards" }}
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d4ed8]/10 flex items-center justify-center group-hover:bg-[#1d4ed8]/20 group-hover:scale-110 transition-all duration-300">
                        <Icon className="h-3.5 w-3.5 text-[#1d4ed8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-relaxed">{bullet.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-[#1f2a37] font-dxtre" data-dtre-mode="true">
      <header className="h-12 bg-[#0d2c56] text-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-24 flex items-center">
            {!logoLoadError ? (
              <img
                src="https://img.logo.dev/dtre.com?size=140&format=png"
                alt="DTRE"
                className="h-6 w-auto object-contain brightness-0 invert"
                onError={() => setLogoLoadError(true)}
              />
            ) : (
              <div className="text-sm font-semibold tracking-wide">DTRE</div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-white/80">
            <span className="rounded bg-white/10 px-2 py-1">Transactions</span>
            <span className="rounded px-2 py-1">Price Analysis</span>
            <span className="rounded px-2 py-1">Take-up</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2 py-1">Comparables Export</span>
          <Search className="h-4 w-4 text-white/70" />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3rem)]">
        <aside className="w-56 shrink-0 border-r border-[#d7dee7] bg-white">
          <nav className="space-y-1 p-3">
            {LEFT_SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon
              const active = activeWorkspace === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveWorkspace(item.id)}
                  className={`w-full flex items-center gap-2 rounded px-3 py-2 text-sm transition ${
                    active ? "bg-[#08a8d8] text-white" : "text-[#2f3f52] hover:bg-[#eef4fb]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="border-b border-[#d7dee7] bg-white px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#dbeafe] text-[#1d4ed8]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {activeWorkspaceLabel}
                </h1>
                <p className="text-sm text-[#4d647d]">
                  Embedded RegionIQ module inside DTRE workflow.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded border border-[#cad5e2] bg-[#f8fbff] px-2 py-1 text-xs">
                <Database className="h-3.5 w-3.5 text-[#1673b1]" />
                <span>{dataQuality}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 p-4">
              {activeWorkspace === "economic-profile" ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-2xl bg-white/45 backdrop-blur-sm p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)]">
                    <div className="absolute inset-0 pointer-events-none">
                      {particles.map((particle, idx) => (
                        <span
                          key={`top-particle-${region}-${year}-${idx}`}
                          className={`absolute rounded-full ${particle.className}`}
                          style={{
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            opacity: particle.opacity * 0.8,
                            background: "rgba(8, 168, 216, 0.6)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {kpiMetrics.map((kpi) => (
                        <div key={kpi.metricId} className="rounded-xl bg-white/78 p-3 backdrop-blur-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                          <div className="text-xs text-[#6b7f94]">{kpi.title}</div>
                          <div className="mt-1 text-lg font-semibold">{kpi.valueText}</div>
                          <div className={`mt-1 text-sm ${kpi.yoyClass}`}>{kpi.yoyText}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/55 backdrop-blur-sm overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)]">
                    <DtreFullWidthMap
                      selectedRegion={region}
                      selectedRegionMetadata={selectedRegionMetadata}
                      mapMetric={mapMetric}
                      year={year}
                      scenario={scenario}
                      allMetricsData={allMetricsData}
                      allMetricsSeriesData={allMetricsSeriesData.map(({ metricId, data }) => ({ metricId, data }))}
                      onRegionSelect={handleRegionChange}
                      onMapMetricChange={handleMapMetricChange}
                      onYearChange={handleYearChange}
                      onScenarioChange={handleScenarioChange}
                    />
                  </div>

                  {floatingInsightPanel}
                </div>
              ) : activeWorkspace === "home" ? (
                <MockSection
                  title="Portfolio Home Dashboard"
                  subtitle="High-level market snapshot stitched into internal workspace."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "export-live" ? (
                <MockSection
                  title="Live Export Workspace"
                  subtitle="Export presets, queued jobs, and dataset health checks."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "research-report" ? (
                <MockSection
                  title="Research Report Workspace"
                  subtitle="Narrative components and evidence charts prefilled for review."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "big-box-report" ? (
                <MockSection
                  title="Big Box Report"
                  subtitle="Sector-specific supply, take-up, and cap-rate snapshots."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "investment-comps" ? (
                <MockSection
                  title="Investment Comps"
                  subtitle="Comparable sales matrix with mocked institution-level details."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "lease-comps" ? (
                <MockSection
                  title="Lease Comps"
                  subtitle="Lease evidence, rent trajectory, and covenant layers."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "asset-viewer" ? (
                <MockSection
                  title="Asset Viewer"
                  subtitle="Asset-centric cards, map, and cross-module context."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "update-live" ? (
                <MockSection
                  title="Live Update Console"
                  subtitle="Pipeline status, ingestion health, and timestamped updates."
                  seed={workspaceSeed}
                />
              ) : activeWorkspace === "create-new" ? (
                <MockSection
                  title="Create New Workspace"
                  subtitle="Mock creation forms and starter module templates."
                  seed={workspaceSeed}
                />
              ) : (
                <MockSection
                  title="Feedback Workspace"
                  subtitle="Structured comments, triage queue, and signal trends."
                  seed={workspaceSeed}
                />
              )}
            </section>

            <aside className="bg-[#f8fbff] p-4 space-y-4">
              <div className="rounded-2xl bg-white/45 backdrop-blur-sm p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.06)]">
                <div className="text-xs font-semibold text-[#233a54]">DXTRE Filter</div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl px-2 py-1.5 text-xs bg-[#f8fcff]/75">
                    <div className="text-[#54708d]">Year</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <input
                        type="range"
                        min={2010}
                        max={2050}
                        value={year}
                        onChange={(e) => handleYearChange(Number(e.target.value))}
                        className="w-full accent-[#08a8d8]"
                      />
                      <span className="w-12 text-right font-medium">{year}</span>
                    </div>
                  </div>

                  <div className="rounded-xl px-2 py-1.5 text-xs bg-[#f8fcff]/75">
                    <div className="text-[#54708d]">Scenario</div>
                    <div className="mt-1 flex gap-1">
                      {SCENARIOS.map((sc) => (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => handleScenarioChange(sc)}
                          className={`rounded px-2 py-1 text-[11px] capitalize ${
                            scenario === sc ? "bg-[#08a8d8] text-white" : "bg-white border border-[#d7dee7]"
                          }`}
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {MOCK_FILTERS.map((filterLabel) => (
                    <div
                      key={filterLabel}
                      className="rounded-xl px-2 py-1.5 text-xs bg-[#f8fcff]/75 flex items-center justify-between text-[#5f7690]"
                    >
                      <span>{filterLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </div>
                  ))}
                </div>
              </div>

              {activeWorkspace !== "economic-profile" ? floatingInsightPanel : null}
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}

