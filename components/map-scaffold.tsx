"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { Map, useMap, type MapRef } from "@vis.gl/react-mapbox"
import { useTheme } from "next-themes"
import "mapbox-gl/dist/mapbox-gl.css"

import { ZoomIn, ZoomOut, Maximize, Info, MapPin, Search, Download, X, Target, ArrowLeft, Globe } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { REGIONS, METRICS, YEARS, type Metric, type Scenario } from "@/lib/metrics.config"
import { formatValue } from "@/lib/data-service"

// ✅ Dynamic overlay
import { MapOverlaysDynamic } from "@/components/map-overlays-dynamic"
import type { RegionMetadata, RegionLevel } from "@/components/region-search"
import type { ChoroplethStats } from "@/lib/map/choropleth-stats"
import { INTERACTIVE_LAYER_IDS, PROPERTY_MAP, SOURCE_ID, canonicalRegionCode, fillLayerId } from "@/lib/map/region-layers"
type MapMode = "value" | "growth"
type MapControlsSide = "left" | "right"
type FullscreenBrandMode = "default" | "dtre"

interface MapScaffoldProps {
  selectedRegion: string
  selectedRegionMetadata?: RegionMetadata | null
  /** Optional "viewport focus" region (used to fit to a parent catchment while rendering child-level fills). */
  focusRegionMetadata?: RegionMetadata | null
  metric: string
  year: number
  scenario: string
  level: RegionLevel // Granularity level (single source of truth)
  mapMode?: MapMode // "value" (absolute) or "growth" (growth rate)
  growthPeriod?: number // Growth period in years (1=YoY, 2, 3, 5, 10, etc.)
  /** Optional: mask the choropleth so only these region codes are fully emphasized (others fade). */
  maskRegionCodes?: string[]
  /** Optional: draw a parent outline boundary layer (e.g. ITL1 boundary while showing LAD fills). */
  parentOutline?: { level: RegionLevel; code: string } | null
  onLevelChange?: (level: RegionLevel) => void
  
  onRegionSelect?: (metadata: RegionMetadata) => void
  onMetricChange?: (metricId: string) => void
  onMapModeChange?: (mode: MapMode) => void
  onGrowthPeriodChange?: (period: number) => void
  onYearChange?: (year: number) => void
  onScenarioChange?: (scenario: Scenario) => void
  onExport?: () => void
  onFullscreenChange?: (isFullscreen: boolean) => void
  className?: string
  showRegionInfo?: boolean // Control whether to show the bottom-left region info bubble
  hideHeader?: boolean // Control whether to hide the CardHeader
  headerSubtitle?: React.ReactNode // Optional line under "Regional Map" (e.g. region name)
  showPersistentControls?: boolean // Show map mode/level/indicator controls outside fullscreen
  showGranularityAtAllLevels?: boolean // Allow granularity toggles even when level is not UK
  showUkGranularityOption?: boolean // Whether to include UK in granularity options
  showViewDetailsCta?: boolean // Show "View Details" button in hover card
  showCatchmentAction?: boolean // Show catchment shortcut in map controls
  metrics?: Metric[] // Optional metric list override (defaults to global METRICS)
  mapControlsSide?: MapControlsSide // Position zoom/fullscreen controls
  fullscreenBrandMode?: FullscreenBrandMode // Fullscreen toolbar logo branding
  mapId: string // Unique map id (required to avoid cross-instance interference)
}

// IMPORTANT:
// Keep `mapLib` stable across renders. Passing `import("mapbox-gl")` inline creates a new Promise
// on each render (e.g. year slider changes), which can trigger Map re-init and break interactivity.
const MAPBOX_LIB = import("mapbox-gl")

/** Controls rendered INSIDE <Map> so useMap("default") is valid */
function MapControls({
  isFullscreen,
  setIsFullscreen,
  mapId,
  shareUrl,
  selectedRegion,
  year,
  scenario,
  showCatchmentAction = true,
  controlsSide = "right",
}: {
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
  mapId: string
  shareUrl: string
  selectedRegion?: string
  year?: number
  scenario?: string
  showCatchmentAction?: boolean
  controlsSide?: MapControlsSide
}) {
  const maps = useMap() as any
  const map = maps?.[mapId] ?? maps?.default ?? maps?.current
  // Resize map when fullscreen state changes
  useEffect(() => {
    if (!map) return
    
    // Use requestAnimationFrame to ensure DOM has updated
    const resizeMap = () => {
      requestAnimationFrame(() => {
        map.resize()
      })
    }
    
    // Immediate resize
    resizeMap()
    
    // Additional resize after a short delay to catch any layout shifts
    const timeout = setTimeout(() => {
      map.resize()
    }, 100)
    
    return () => clearTimeout(timeout)
  }, [map, isFullscreen])

  const handleZoomIn = () => {
    const z = map?.getZoom() ?? 5
    map?.zoomTo(Math.min(z + 1, 12), { duration: 250 })
  }

  const handleZoomOut = () => {
    const z = map?.getZoom() ?? 5
    map?.zoomTo(Math.max(z - 1, 3), { duration: 250 })
  }

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }


  return (
    <div className={cn(
      "absolute flex flex-col gap-2 z-30",
      isFullscreen
        ? (controlsSide === "left" ? "top-36 left-3" : "top-36 right-3")
        : (controlsSide === "left" ? "top-3 left-3" : "top-3 right-3")
    )}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleZoomIn} 
            className={cn(
              "p-0 opacity-80 hover:opacity-100 transition-opacity",
              isFullscreen ? "h-8 w-8" : "h-6 w-6"
            )}
          >
            <ZoomIn className={isFullscreen ? "h-3.5 w-3.5" : "h-3 w-3"} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center" sideOffset={10} className="pointer-events-none">
          Zoom In
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleZoomOut} 
            className={cn(
              "p-0 opacity-80 hover:opacity-100 transition-opacity",
              isFullscreen ? "h-8 w-8" : "h-6 w-6"
            )}
          >
            <ZoomOut className={isFullscreen ? "h-3.5 w-3.5" : "h-3 w-3"} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center" sideOffset={10} className="pointer-events-none">
          Zoom Out
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFullscreen}
            className={cn(
              "p-0 opacity-80 hover:opacity-100 transition-opacity",
              isFullscreen ? "h-8 w-8" : "h-6 w-6"
            )}
          >
            <Maximize className={isFullscreen ? "h-3.5 w-3.5" : "h-3 w-3"} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" align="center" sideOffset={10} className="pointer-events-none">
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </TooltipContent>
      </Tooltip>

      {showCatchmentAction ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={`/catchment${selectedRegion ? `?region=${selectedRegion}${year ? `&year=${year}` : ""}${scenario && scenario !== "baseline" ? `&scenario=${scenario}` : ""}` : ""}`}>
              <Button
                variant="secondary"
                size="sm"
                className={cn(
                  "p-0 opacity-80 hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20",
                  isFullscreen ? "h-8 w-8" : "h-6 w-6"
                )}
              >
                <Target className={isFullscreen ? "h-3.5 w-3.5" : "h-3 w-3"} />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="left" align="center" sideOffset={10} className="pointer-events-none">
            Catchment Analysis
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

/** Layout → Mapbox sync: ensure canvas always matches container after layout churn */
function MapLayoutSync({
  isFullscreen,
  year,
  level,
  containerRef,
  mapId,
}: {
  isFullscreen: boolean
  year: number
  level: RegionLevel
  containerRef: React.RefObject<HTMLDivElement | null>
  mapId: string
}) {
  const maps = useMap() as any
  const mapRef = maps?.[mapId] ?? maps?.default ?? maps?.current

  // Resolve to underlying Mapbox GL JS map when possible, but MapRef.resize() is also valid.
  const getMap = () => (mapRef as any)?.getMap?.() ?? mapRef

  // Required: post-layout resize on any state that can change layout/paint.
  useEffect(() => {
    const map = getMap()
    if (!map) return

    // Let DOM/layout settle before resizing the canvas
    requestAnimationFrame(() => {
      try {
        map.resize?.()
      } catch {
        // ignore
      }

      // Dev guardrail: catch the “canvas is unexpectedly small” class of bugs early.
      if (process.env.NODE_ENV === "development") {
        try {
          const c = map.getCanvas?.()
          const r = c?.getBoundingClientRect?.()
          console.assert(
            r?.width > 200 && r?.height > 200,
            "Map canvas is unexpectedly small after resize",
            r
          )
        } catch {
          // ignore
        }
      }
    })
  }, [year, level, isFullscreen])

  // Strongly recommended: ResizeObserver on the actual container div (not the canvas).
  useEffect(() => {
    const map = getMap()
    const el = containerRef.current
    if (!map || !el || typeof ResizeObserver === "undefined") return

    const ro = new ResizeObserver(() => {
      try {
        map.resize?.()
      } catch {
        // ignore
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return null
}

/** Map resize handler - must be inside Map component to access useMap */
function MapResizeHandler({ isFullscreen, mapId }: { isFullscreen: boolean; mapId: string }) {
  const maps = useMap() as any
  const map = maps?.[mapId] ?? maps?.default ?? maps?.current

  // Resize map when fullscreen state changes or container size changes
  useEffect(() => {
    if (!map) return

    // Find the map container element
    const mapContainer = map.getContainer()
    if (!mapContainer) return

    // Watch for container size changes using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls to avoid excessive updates
      requestAnimationFrame(() => {
        map.resize()
      })
    })

    resizeObserver.observe(mapContainer)

    // Immediate resize on fullscreen change
    const resizeMap = () => {
      // Multiple resize attempts to catch all layout shifts
      requestAnimationFrame(() => {
        map.resize()
        requestAnimationFrame(() => {
          map.resize()
        })
      })
    }

    resizeMap()

    // Additional delayed resizes to catch any async layout changes
    const timeouts = [
      setTimeout(() => map.resize(), 50),
      setTimeout(() => map.resize(), 150),
      setTimeout(() => map.resize(), 300),
    ]

    return () => {
      timeouts.forEach(clearTimeout)
      resizeObserver.disconnect()
    }
  }, [map, isFullscreen])

  return null
}

/** Fullscreen top toolbar - shows year slider, scenario, and back button */
function FullscreenToolbar({
  year,
  scenario,
  onYearChange,
  onScenarioChange,
  onBack,
  brandMode = "default",
}: {
  year: number
  scenario: Scenario
  onYearChange?: (year: number) => void
  onScenarioChange?: (scenario: Scenario) => void
  onBack?: () => void
  brandMode?: FullscreenBrandMode
}) {
  const [dtreLogoLoadError, setDtreLogoLoadError] = useState(false)
  // Calculate the position of the year label
  const getYearLabelPosition = () => {
    const percentage = ((year - YEARS.min) / (YEARS.max - YEARS.min)) * 100
    return percentage
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-[10] border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        {/* Left cluster: Logo + title */}
        <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
          {/* Logo */}
          <div className="relative h-16 w-16 flex-shrink-0">
            {brandMode === "dtre" ? (
              !dtreLogoLoadError ? (
                <img
                  src="https://img.logo.dev/dtre.com?size=140&format=png"
                  alt="DTRE"
                  className="h-16 w-16 object-contain"
                  onError={() => setDtreLogoLoadError(true)}
                />
              ) : (
                <div className="h-16 w-16 flex items-center justify-center text-sm font-semibold tracking-wide text-foreground">
                  DTRE
                </div>
              )
            ) : (
              <>
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </>
            )}
          </div>
          <div className="h-8 w-px bg-border/50" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              Regional Map
            </h2>
          </div>
        </div>

        {/* Right cluster: Year slider + Scenario + Back */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Year slider */}
          <div className="w-[280px]">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Year</span>
              </div>
              
              <Slider
                value={[year]}
                onValueChange={(value) => onYearChange?.(value[0])}
                min={YEARS.min}
                max={YEARS.max}
                step={1}
                className="w-full"
              />
              
              {/* Dynamic year text below slider */}
              <div className="relative h-4">
                <div 
                  className="absolute transform -translate-x-1/2 text-sm font-medium pointer-events-none"
                  style={{ 
                    left: `${getYearLabelPosition()}%`,
                    transition: 'none'
                  }}
                >
                  {year}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{YEARS.min}</span>
                <span>{YEARS.max}</span>
              </div>
            </div>
          </div>

          {/* Scenario Toggle */}
          <div className="flex rounded-lg border p-1">
            {(["baseline", "upside", "downside"] as const).map((s) => (
              <Button
                key={s}
                variant={scenario === s ? "default" : "ghost"}
                size="sm"
                onClick={() => onScenarioChange?.(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>

          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Level selector and Metric selector for fullscreen mode */
function FullscreenControls({
  currentMetric,
  currentLevel,
  metrics = METRICS,
  currentMapMode,
  currentGrowthPeriod,
  onMetricChange,
  onLevelChange,
  onMapModeChange,
  onGrowthPeriodChange,
  showGranularityAtAllLevels = false,
  showUkGranularityOption = true,
}: {
  currentMetric: string
  currentLevel: RegionLevel
  metrics?: Metric[]
  currentMapMode?: MapMode
  currentGrowthPeriod?: number
  onMetricChange?: (metricId: string) => void
  onLevelChange?: (level: RegionLevel) => void
  onMapModeChange?: (mode: MapMode) => void
  onGrowthPeriodChange?: (period: number) => void
  showGranularityAtAllLevels?: boolean
  showUkGranularityOption?: boolean
}) {
  const levels: RegionLevel[] = showUkGranularityOption
    ? ["UK", "ITL1", "ITL2", "ITL3", "LAD"]
    : ["ITL1", "ITL2", "ITL3", "LAD"]

  return (
    <div className="absolute bottom-10 right-4 z-[10] flex flex-col gap-3 max-w-[calc(100vw-2rem)]">
      {/* Map Display Mode Toggle */}
      {onMapModeChange && (
        <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg p-3">
          <h4 className="text-sm font-semibold mb-2 text-foreground/90">Map Display</h4>
          <div className="flex rounded-lg border p-1">
            <Button
              variant={currentMapMode === "value" ? "default" : "ghost"}
              size="sm"
              onClick={() => onMapModeChange("value")}
              className={cn(
                "flex-1 text-xs px-2 whitespace-nowrap",
                currentMapMode === "value"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              Absolute Value
            </Button>
            <Button
              variant={currentMapMode === "growth" ? "default" : "ghost"}
              size="sm"
              onClick={() => onMapModeChange("growth")}
              className={cn(
                "flex-1 text-xs px-2 whitespace-nowrap",
                currentMapMode === "growth"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              Growth Rate
            </Button>
          </div>
          {currentMapMode === "growth" && onGrowthPeriodChange && (
            <div className="mt-2 space-y-1.5">
              <h5 className="text-xs font-medium text-foreground/70">Growth Period</h5>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 5, 10].map((period) => (
                  <Button
                    key={period}
                    variant={currentGrowthPeriod === period ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onGrowthPeriodChange(period)}
                    className={cn(
                      "text-xs h-6 px-2",
                      currentGrowthPeriod === period
                        ? "bg-background shadow-sm text-foreground font-medium"
                        : "bg-transparent hover:bg-background/50 text-muted-foreground"
                    )}
                  >
                    {period === 1 ? "YoY" : `${period}yr`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Level Selector - Only show when UK is selected (other levels navigate via click) */}
      {onLevelChange && (currentLevel === "UK" || showGranularityAtAllLevels) && (
        <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg p-3">
          <h4 className="text-sm font-semibold mb-2 text-foreground/90">Granularity</h4>
          <div className="flex rounded-lg border p-1">
            {levels.map((level) => (
              <Button
                key={level}
                variant={currentLevel === level ? "default" : "ghost"}
                size="sm"
                onClick={() => onLevelChange(level)}
                className={cn(
                  "text-xs px-2",
                  currentLevel === level
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {level}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Metric Selector */}
      {onMetricChange && (
        <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg p-4 w-[260px]">
          <h4 className="text-sm font-semibold mb-3 text-foreground/90">Indicators</h4>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {metrics.map((m) => {
              const isSelected = m.id === currentMetric
              return (
                <Button
                  key={m.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => onMetricChange(m.id)}
                  className={cn(
                    "w-full justify-start gap-2 h-auto min-h-[2rem] py-1.5 text-xs",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      isSelected ? "bg-primary" : "border border-current opacity-50"
                    )}
                  />
                  <span className="text-left leading-snug">{m.title}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Map container component - renders the actual map with proper dimensions */
function MapContainerInner({
  selectedRegion,
  selectedRegionMetadata,
  focusRegionMetadata,
  metrics = METRICS,
  metric,
  year,
  scenario,
  level,
  mapMode = "value",
  growthPeriod = 5,
  maskRegionCodes,
  parentOutline,
  onLevelChange,
  onRegionSelect,
  onMetricChange,
  onMapModeChange,
  onGrowthPeriodChange,
  onYearChange,
  onScenarioChange,
  onExport,
  isFullscreen,
  setIsFullscreen,
  showRegionInfo = true,
  showPersistentControls = false,
  showGranularityAtAllLevels = false,
  showUkGranularityOption = true,
  showViewDetailsCta = true,
  showCatchmentAction = true,
  mapControlsSide = "right",
  fullscreenBrandMode = "default",
  mapId,
}: {
  selectedRegion: string
  selectedRegionMetadata?: RegionMetadata | null
  focusRegionMetadata?: RegionMetadata | null
  metrics?: Metric[]
  metric: string
  year: number
  scenario: string
  level: RegionLevel
  mapMode?: MapMode
  growthPeriod?: number
  maskRegionCodes?: string[]
  parentOutline?: { level: RegionLevel; code: string } | null
  onLevelChange?: (level: RegionLevel) => void
  onRegionSelect?: (metadata: RegionMetadata) => void
  onMetricChange?: (metricId: string) => void
  onMapModeChange?: (mode: MapMode) => void
  onGrowthPeriodChange?: (period: number) => void
  onYearChange?: (year: number) => void
  onScenarioChange?: (scenario: Scenario) => void
  onExport?: () => void
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
  showRegionInfo?: boolean
  showPersistentControls?: boolean
  showGranularityAtAllLevels?: boolean
  showUkGranularityOption?: boolean
  showViewDetailsCta?: boolean
  showCatchmentAction?: boolean
  mapControlsSide?: MapControlsSide
  fullscreenBrandMode?: FullscreenBrandMode
  mapId: string
}) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const region = REGIONS.find((r) => r.code === selectedRegion)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef | null>(null)
  // Keep a direct reference to the underlying Mapbox GL JS map instance.
  // Rationale: refs like MapRef can be temporarily null during churn; the onLoad `e.target`
  // is the most reliable way to capture the real map for hit-testing + debug instrumentation.
  const mapboxRef = useRef<any>(null)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastClickRef = useRef<{ time: number; regionCode: string } | null>(null)
  const [themeMounted, setThemeMounted] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Track mount state for hydration-safe theme detection
  useEffect(() => setThemeMounted(true), [])
  
  // Reset map loaded state when theme changes to show skeleton during style swap
  useEffect(() => {
    setMapLoaded(false)
  }, [themeMounted && resolvedTheme])

  // Dynamic map style based on theme
  const mapStyle = themeMounted && resolvedTheme === "dark"
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11"

  const [hoverInfo, setHoverInfo] = useState<{
    x: number
    y: number
    name: string
    value: number | null
    code?: string
    rank?: number | null
    n?: number | null
    percentile?: number | null
    pinnedName?: string | null
    deltaAbs?: number | null
    deltaPct?: number | null
  } | null>(null)

  const lastHoverFeatureIdRef = useRef<string | number | null>(null)

  const [choroplethStats, setChoroplethStats] = useState<ChoroplethStats | null>(null)
  const [pinned, setPinned] = useState<{
    rawCode: string
    canonicalCode: string
    name: string
    value: number | null
  } | null>(null)

  const metricInfo = useMemo(() => metrics.find((m) => m.id === metric), [metric, metrics])

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    const url = new URL(window.location.href)
    url.searchParams.set("region", selectedRegionMetadata?.code ?? selectedRegion)
    url.searchParams.set("year", String(year))
    url.searchParams.set("scenario", scenario)
    url.searchParams.set("level", level)
    url.searchParams.set("metric", metric)
    return url.toString()
  }, [level, metric, scenario, selectedRegion, selectedRegionMetadata?.code, year])

  // Clear pinned comparison when the metric context changes (otherwise Δ/rank become misleading).
  // IMPORTANT: do NOT clear on `level` changes; a click-to-select can update level immediately,
  // which would make the pinned card disappear before the user even sees it.
  useEffect(() => {
    setPinned(null)
  }, [metric, year, scenario])

  // REQUIRED: always hit-test against the real Mapbox GL JS map instance.
  const getMapbox = useCallback(() => {
    return mapboxRef.current ?? mapRef.current?.getMap?.()
  }, [])

  // Optional dev debug: expose Mapbox map for console inspection.
  // NOTE: We also set this in `onLoad` because `useEffect` can run before Mapbox is ready.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    ;(window as any).__MAPBOX__ = (window as any).__MAPBOX__ ?? {}
    const m = getMapbox()
    // Never overwrite a previously-captured map with null/undefined.
    if (m) (window as any).__MAPBOX__[mapId] = m
  }, [getMapbox, mapId])

  // Dev-only: assign a stable RID to the underlying Mapbox instance so we can detect identity drift.
  const assignRid = useCallback(() => {
    if (process.env.NODE_ENV !== "development") return
    const mapbox = getMapbox()
    if (!mapbox) return
    ;(mapbox as any).__RID = (mapbox as any).__RID ?? Math.random().toString(36).slice(2)
    ;(window as any).__MAPBOX_RIDS__ = (window as any).__MAPBOX_RIDS__ ?? {}
    ;(window as any).__MAPBOX_RIDS__[mapId] = (mapbox as any).__RID
    // eslint-disable-next-line no-console
    console.log(`[Map] RID mapId=${mapId} rid=${(mapbox as any).__RID}`)
  }, [getMapbox, mapId])

  // On any churn trigger, log RID and canvas rect once (dev-only).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    const mapbox = getMapbox()
    if (!mapbox) return
    assignRid()
    try {
      const r = mapbox.getCanvas?.()?.getBoundingClientRect?.()
      // eslint-disable-next-line no-console
      console.log(`[Map] CHURN mapId=${mapId} year=${year} level=${level}`, r)
    } catch {
      // ignore
    }
  }, [assignRid, getMapbox, mapId, year, level])

  const clearHover = useCallback(() => {
    setHoverInfo(null)
    if (lastHoverFeatureIdRef.current != null) {
      try {
        const mapbox = getMapbox()
        mapbox?.setFeatureState?.(
          { source: SOURCE_ID, id: lastHoverFeatureIdRef.current },
          { hover: false }
        )
      } catch {
        // ignore
      }
      lastHoverFeatureIdRef.current = null
    }
  }, [getMapbox])

  const pickFeature = useCallback(
    (
      features: any[] | undefined | null,
      point?: { x: number; y: number }
    ) => {
      // Prefer react-mapbox provided features when available.
      // If they are missing (common during style/source churn), fall back to Mapbox's own hit testing.
      let candidates = features ?? []
      const mapbox = getMapbox()

      if (candidates.length === 0 && mapbox && point) {
        try {
          // IMPORTANT: do NOT pass `{ layers: [...] }` here — Mapbox throws if any layer ID is missing
          // during churn. Query everything and filter in JS.
          candidates = mapbox.queryRenderedFeatures([point.x, point.y]) ?? []
        } catch {
          candidates = []
        }
      }

      if (!candidates || candidates.length === 0) return null

      // Only keep features from our region fill layers (ignore outlines, symbols, basemap layers).
      const allowed = candidates.filter((ft: any) => INTERACTIVE_LAYER_IDS.includes(ft?.layer?.id))
      if (allowed.length === 0) return null

      // Risk A hardening: deterministic selection regardless of Mapbox feature ordering.
      // Priority: current level first, then fixed order.
      const priority: RegionLevel[] = [level, "ITL1", "ITL2", "ITL3", "LAD"]
      const seen = new Set<RegionLevel>()
      const uniquePriority = priority.filter((l) => (seen.has(l) ? false : (seen.add(l), true)))

      const picked = uniquePriority
        .map((l) => ({ l, f: allowed.find((ft: any) => ft?.layer?.id === fillLayerId(l)) }))
        .find((x) => Boolean(x.f))

      const preferred = picked?.f
      const featureLevel = picked?.l
      if (!preferred || !featureLevel) return null

      const propMap = PROPERTY_MAP[featureLevel]
      const rawCode = preferred?.properties?.[propMap.code] as string | undefined
      if (!rawCode) return null

      return { feature: preferred, rawCode, featureLevel }
    },
    [getMapbox, level]
  )

  const handleMapMouseMove = useCallback(
    (e: any) => {
      const mapbox = getMapbox()
      if (process.env.NODE_ENV === "development") {
        console.assert(
          typeof mapbox?.queryRenderedFeatures === "function",
          "Expected Mapbox GL JS map instance"
        )
      }
      if (!mapbox) return

      // Always hit-test via Mapbox; use event.features as a hint only.
      const picked = pickFeature(e?.features, e?.point)
      if (!picked) {
        clearHover()
        return
      }

      const { feature, rawCode, featureLevel } = picked
      const propMap = PROPERTY_MAP[featureLevel]
      const name = (feature?.properties?.[propMap.name] as string | undefined) ?? "Unknown"
      const value = (feature?.properties?.value as number | null | undefined) ?? null

      // Highlight via feature-state (GPU-side)
      if (lastHoverFeatureIdRef.current !== rawCode) {
        if (lastHoverFeatureIdRef.current != null) {
          try {
            mapbox.setFeatureState(
              { source: SOURCE_ID, id: lastHoverFeatureIdRef.current },
              { hover: false }
            )
          } catch {
            // ignore
          }
        }
        try {
          mapbox.setFeatureState({ source: SOURCE_ID, id: rawCode }, { hover: true })
        } catch {
          // ignore
        }
        lastHoverFeatureIdRef.current = rawCode
      }

      const canonicalCode = canonicalRegionCode(featureLevel as any, rawCode) ?? rawCode

      // Rank/percentile is computed within the current level’s choropleth (when available).
      const stats =
        choroplethStats && choroplethStats.level === (featureLevel as any) ? choroplethStats : null
      const rank = stats?.rankByCode?.[rawCode] ?? null
      const n = stats?.n ?? null
      const percentile =
        rank != null && n != null && n > 1 ? ((n - rank) / (n - 1)) * 100 : rank != null && n === 1 ? 100 : null

      const pinnedName = pinned ? pinned.name : null
      const deltaAbs =
        pinned && pinned.value != null && value != null ? value - pinned.value : null
      const deltaPct =
        pinned && pinned.value != null && pinned.value !== 0 && value != null
          ? ((value - pinned.value) / pinned.value) * 100
          : null

      setHoverInfo({
        x: e?.point?.x ?? 0,
        y: e?.point?.y ?? 0,
        name,
        value: value != null && isFinite(value as any) ? (value as any) : null,
        code: canonicalCode,
        rank,
        n,
        percentile,
        pinnedName,
        deltaAbs,
        deltaPct,
      })
    },
    [choroplethStats, clearHover, getMapbox, level, pickFeature, pinned]
  )

  const handleMapMouseLeave = useCallback((e: any) => {
    clearHover()
  }, [clearHover])

  const handleMapClick = useCallback(
    async (e: any) => {
      if (!onRegionSelect) return
      const mapbox = getMapbox()
      if (!mapbox) return

      const picked = pickFeature(e?.features, e?.point)
      if (!picked) return

      const { feature, rawCode, featureLevel } = picked
      const regionCode = canonicalRegionCode(featureLevel as any, rawCode) ?? rawCode
      const propMap = PROPERTY_MAP[featureLevel]
      const name = (feature?.properties?.[propMap.name] as string | undefined) ?? regionCode
      const value = (feature?.properties?.value as number | null | undefined) ?? null

      // Clear any pending single-click timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
        clickTimeoutRef.current = null
      }

      // Check for double-click (within 400ms and same region)
      const now = Date.now()
      const lastClick = lastClickRef.current
      if (lastClick && now - lastClick.time < 400 && lastClick.regionCode === regionCode) {
        // Double-click detected - navigate to metric detail page
        lastClickRef.current = null
        try {
          router.push(`/metric/${metric}?region=${regionCode}&year=${year}&scenario=${scenario}`)
        } catch (error) {
          console.error("Navigation error:", error)
        }
        return
      }

      // Store click for double-click detection
      lastClickRef.current = { time: now, regionCode }

      // Delay single-click action to allow for double-click detection
      clickTimeoutRef.current = setTimeout(async () => {
        clickTimeoutRef.current = null
        lastClickRef.current = null

        // Click-to-pin (A): click a region to pin it; click the same region again to unpin.
        setPinned((prev) => {
          if (prev?.rawCode === rawCode) return null
          return {
            rawCode,
            canonicalCode: regionCode,
            name,
            value: value != null && isFinite(value as any) ? (value as any) : null,
          }
        })

        // Try region-index.json for canonical metadata + bbox
        try {
          const response = await fetch("/processed/region-index.json")
          const index = await response.json()
          if (index?.[regionCode]) {
            const metadata = index[regionCode]
            onRegionSelect({
              code: regionCode,
              name: metadata.name || name,
              level: metadata.level || (featureLevel as any),
              bbox: metadata.bbox,
            })
            return
          }
        } catch {
          // ignore
        }

        // Fallback: use bbox on feature properties (added by preprocessing) if present
        const fb = feature?.properties?.bbox
        const bboxVal =
          Array.isArray(fb) && fb.length === 4 ? (fb as [number, number, number, number]) : undefined

        onRegionSelect({
          code: regionCode,
          name,
          level: featureLevel as any,
          bbox: bboxVal ?? [-8, 49.5, 2, 61],
        })
      }, 400) // Wait 400ms to see if a second click comes
    },
    [level, onRegionSelect, pickFeature, router, metric, year, scenario]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  // Risk B hardening: dev-time invariants to prevent silent regressions
  if (process.env.NODE_ENV === "development") {
    console.assert(
      INTERACTIVE_LAYER_IDS.includes(fillLayerId(level as any) as any),
      `Active level ${level} is not interactive: ${fillLayerId(level as any)} missing from INTERACTIVE_LAYER_IDS`
    )
    console.assert(
      INTERACTIVE_LAYER_IDS.length === 5 &&
        INTERACTIVE_LAYER_IDS[0] === "uk-fill" &&
        INTERACTIVE_LAYER_IDS[1] === "itl1-fill" &&
        INTERACTIVE_LAYER_IDS[2] === "itl2-fill" &&
        INTERACTIVE_LAYER_IDS[3] === "itl3-fill" &&
        INTERACTIVE_LAYER_IDS[4] === "lad-fill",
      `INTERACTIVE_LAYER_IDS was changed; this commonly reintroduces interactivity gating bugs.`
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={
        // In fullscreen: explicit viewport dimensions via parent portal
        // In normal mode: inherits from parent (100% height, no padding)
        isFullscreen
          ? {
              width: "100%",
              height: "100%",
              padding: "0",
              margin: "0",
            }
          : {
              width: "100%",
              height: "100%",
              padding: "0",
              margin: "0",
              boxSizing: "border-box",
            }
      }
          >
            {/* Map loading skeleton - pulsing UK outline (branded loading state) */}
            {!mapLoaded && (
              <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  {/* Animated UK silhouette SVG */}
                  <div className="relative">
                    {/* Outer pulse ring */}
                    <div className="absolute inset-0 -m-4 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: "2s" }} />
                    <div className="absolute inset-0 -m-2 rounded-full bg-primary/5 animate-pulse" />
                    
                    {/* UK outline SVG - simplified silhouette */}
                    <svg
                      width="80"
                      height="100"
                      viewBox="0 0 80 100"
                      className="relative z-10"
                      style={{
                        filter: "drop-shadow(0 0 8px rgba(var(--primary), 0.3))",
                      }}
                    >
                      {/* UK silhouette path - simplified but recognizable */}
                      <path
                        d="M35 5 L45 3 L55 8 L58 15 L52 22 L60 28 L65 25 L70 30 L68 40 L72 48 L68 55 L60 52 L55 58 L58 65 L52 70 L55 78 L48 85 L40 82 L35 88 L28 85 L25 92 L18 95 L12 88 L8 80 L12 72 L8 65 L15 58 L10 50 L18 42 L12 35 L18 28 L25 32 L30 25 L25 18 L30 12 L35 5 Z"
                        className="fill-primary/20 stroke-primary"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: 300,
                          strokeDashoffset: 0,
                          animation: "uk-draw 2s ease-in-out infinite",
                        }}
                      />
                      {/* Scotland highlight */}
                      <circle
                        cx="38"
                        cy="20"
                        r="3"
                        className="fill-primary/40"
                        style={{
                          animation: "uk-pulse 1.5s ease-in-out infinite",
                          animationDelay: "0s",
                        }}
                      />
                      {/* London highlight */}
                      <circle
                        cx="55"
                        cy="65"
                        r="3"
                        className="fill-primary/40"
                        style={{
                          animation: "uk-pulse 1.5s ease-in-out infinite",
                          animationDelay: "0.5s",
                        }}
                      />
                      {/* Wales highlight */}
                      <circle
                        cx="25"
                        cy="60"
                        r="2.5"
                        className="fill-primary/40"
                        style={{
                          animation: "uk-pulse 1.5s ease-in-out infinite",
                          animationDelay: "1s",
                        }}
                      />
                    </svg>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                    <span>Loading regional data</span>
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
                
                {/* CSS keyframes for UK loading animation */}
                <style jsx>{`
                  @keyframes uk-draw {
                    0%, 100% {
                      stroke-dashoffset: 0;
                      opacity: 1;
                    }
                    50% {
                      stroke-dashoffset: 50;
                      opacity: 0.7;
                    }
                  }
                  @keyframes uk-pulse {
                    0%, 100% {
                      transform: scale(1);
                      opacity: 0.4;
                    }
                    50% {
                      transform: scale(1.5);
                      opacity: 0.8;
                    }
                  }
                `}</style>
              </div>
            )}
            
            <Map
              id={mapId}
              ref={mapRef as any}
              mapLib={MAPBOX_LIB}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              initialViewState={{ longitude: -2, latitude: 54.5, zoom: 4.8 }}
        style={{ width: "100%", height: "100%", padding: "0", margin: "0", display: "block" }}
              mapStyle={mapStyle}
              reuseMaps={false}
              onLoad={(e: any) => {
                // Capture the underlying Mapbox GL JS map instance (most reliable).
                mapboxRef.current = e?.target ?? mapRef.current?.getMap?.() ?? null

                if (process.env.NODE_ENV === "development") {
                  ;(window as any).__MAPBOX__ = (window as any).__MAPBOX__ ?? {}
                  ;(window as any).__MAPBOX__[mapId] = mapboxRef.current
                }

                // Dev-only: capture initial Mapbox instance identity
                assignRid()
                
                // Mark map as loaded to hide skeleton
                setMapLoaded(true)
              }}
              // IMPORTANT:
              // `interactiveLayerIds` must remain constant and include ALL region fill layers.
              // Do NOT make this conditional on `level` (this reintroduces “dead hover/click until refresh” bugs).
              // See: map interactivity invariants.
              interactiveLayerIds={INTERACTIVE_LAYER_IDS as any}
              onMouseMove={handleMapMouseMove}
              onMouseLeave={handleMapMouseLeave}
              onClick={handleMapClick}
            >
        {/* ✅ Layout sync - ensures canvas matches container after year/level/fullscreen churn */}
        <MapLayoutSync
          isFullscreen={isFullscreen}
          year={year}
          level={level}
          containerRef={containerRef}
          mapId={mapId}
        />
        {/* ✅ Resize handler - keeps map responsive to container changes (legacy safety net) */}
        <MapResizeHandler isFullscreen={isFullscreen} mapId={mapId} />

              {/* ✅ Dynamic overlay */}
              <MapOverlaysDynamic
                show={true}
                metric={metric}
                year={year}
                scenario={scenario}
                level={level}
                mapMode={mapMode}
                growthPeriod={growthPeriod}
                selectedRegion={selectedRegionMetadata}
                focusRegion={focusRegionMetadata}
                maskRegionCodes={maskRegionCodes}
                parentOutline={parentOutline}
                hoverInfo={hoverInfo}
                onChoroplethStats={setChoroplethStats}
                showViewDetailsCta={showViewDetailsCta}
                mapId={mapId}
              />

              {/* Pinned reference card (always visible when pinned) */}
              {pinned ? (
                <div
                  className={cn(
                    "absolute z-30 pointer-events-auto",
                    // Keep this under the zoom/fullscreen control stack in both normal and fullscreen modes.
                    isFullscreen
                      ? mapControlsSide === "left"
                        ? "top-80 left-3"
                        : "top-80 right-3 left-auto"
                      : mapControlsSide === "left"
                        ? "top-32 left-3"
                        : "top-32 right-3 left-auto"
                  )}
                >
                  <div className="font-sans bg-card/95 backdrop-blur border rounded-lg shadow-sm px-3 py-2 min-w-[240px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Pinned</div>
                        <div className="text-sm font-semibold truncate">
                          {pinned.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({pinned.canonicalCode})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <span>Value</span>
                            <span className="font-medium text-foreground">
                              {pinned.value != null
                                ? formatValue(
                                    pinned.value,
                                    metricInfo?.unit || "",
                                    metricInfo?.decimals || 0
                                  )
                                : "No data"}
                            </span>
                          </div>
                          {choroplethStats &&
                          choroplethStats.level === level &&
                          choroplethStats.n > 0 &&
                          choroplethStats.rankByCode[pinned.rawCode] ? (
                            <div className="flex items-center justify-between gap-3">
                              <span>Rank</span>
                              <span className="font-medium text-foreground">
                                {choroplethStats.rankByCode[pinned.rawCode]}/{choroplethStats.n}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-70 hover:opacity-100"
                        onClick={() => setPinned(null)}
                        aria-label="Clear pinned region"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Data coverage badge */}
              {choroplethStats && choroplethStats.level === level ? (
                <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
                  <div className="bg-card/90 backdrop-blur border rounded-md px-2 py-1 text-xs text-muted-foreground">
                    Data coverage:{" "}
                    <span className="font-medium text-foreground">
                      {choroplethStats.n}/{choroplethStats.total}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* ✅ Controls */}
              <MapControls
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
                mapId={mapId}
                shareUrl={shareUrl}
                selectedRegion={selectedRegion}
                year={year}
                scenario={scenario}
                showCatchmentAction={showCatchmentAction}
                controlsSide={mapControlsSide}
              />
            </Map>

      {/* Fullscreen UI elements */}
      {isFullscreen && (
        <>
          <FullscreenToolbar
            year={year}
            scenario={scenario as Scenario}
            onYearChange={onYearChange}
            onScenarioChange={onScenarioChange}
            onBack={() => setIsFullscreen(false)}
            brandMode={fullscreenBrandMode}
          />
        </>
      )}

      {/* Map controls are available in fullscreen and optional persistent mode */}
      {(isFullscreen || showPersistentControls) && (
        <>
          <FullscreenControls
            currentMetric={metric}
            currentLevel={level}
            metrics={metrics}
            currentMapMode={mapMode}
            currentGrowthPeriod={growthPeriod}
            onMetricChange={onMetricChange}
            onLevelChange={onLevelChange}
            onMapModeChange={onMapModeChange}
            onGrowthPeriodChange={onGrowthPeriodChange}
            showGranularityAtAllLevels={showGranularityAtAllLevels}
            showUkGranularityOption={showUkGranularityOption}
          />
        </>
      )}

      {/* Selected Region Info - only show if showRegionInfo is true */}
      {region && showRegionInfo && (
              <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-lg border p-3 min-w-[220px] z-[1]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{region.code}</Badge>
                  <span className="font-medium text-sm">{region.name}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{region.country}</div>
                  <div>Level: {region.level}</div>
                  <div className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Choropleth driven by Supabase
                  </div>
                </div>
              </div>
            )}
          </div>
  )
}

export function MapScaffold({
  selectedRegion,
  selectedRegionMetadata,
  focusRegionMetadata,
  metrics = METRICS,
  metric,
  year,
  scenario,
  level,
  mapMode = "value",
  growthPeriod = 5,
  maskRegionCodes,
  parentOutline,
  onLevelChange,
  onRegionSelect,
  onMetricChange,
  onMapModeChange,
  onGrowthPeriodChange,
  onYearChange,
  onScenarioChange,
  onExport,
  onFullscreenChange,
  className,
  showRegionInfo = true,
  hideHeader = false,
  headerSubtitle,
  showPersistentControls = false,
  showGranularityAtAllLevels = false,
  showUkGranularityOption = true,
  showViewDetailsCta = true,
  showCatchmentAction = true,
  mapControlsSide = "right",
  fullscreenBrandMode = "default",
  mapId,
}: MapScaffoldProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Definitive lifecycle probe (dev-only): detect remounts on year change, etc.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    // eslint-disable-next-line no-console
    console.log(`[MapScaffold] MOUNT mapId=${mapId}`)
    return () => {
      // eslint-disable-next-line no-console
      console.log(`[MapScaffold] UNMOUNT mapId=${mapId}`)
    }
  }, [mapId])

  // Ensure we only render portal after mount (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Notify parent when fullscreen state changes
  useEffect(() => {
    onFullscreenChange?.(isFullscreen)
  }, [isFullscreen, onFullscreenChange])

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isFullscreen])

  const region = REGIONS.find((r) => r.code === selectedRegion)

  const mapContent = (
    <MapContainerInner
      selectedRegion={selectedRegion}
      selectedRegionMetadata={selectedRegionMetadata}
      focusRegionMetadata={focusRegionMetadata}
      metrics={metrics}
      metric={metric}
      year={year}
      scenario={scenario}
      level={level}
      mapMode={mapMode}
      growthPeriod={growthPeriod}
      maskRegionCodes={maskRegionCodes}
      parentOutline={parentOutline}
      onLevelChange={onLevelChange}
      onRegionSelect={onRegionSelect}
      onMetricChange={onMetricChange}
      onMapModeChange={onMapModeChange}
      onGrowthPeriodChange={onGrowthPeriodChange}
      onYearChange={onYearChange}
      onScenarioChange={onScenarioChange}
      onExport={onExport}
      isFullscreen={isFullscreen}
      setIsFullscreen={setIsFullscreen}
      showRegionInfo={showRegionInfo}
      showPersistentControls={showPersistentControls}
      showGranularityAtAllLevels={showGranularityAtAllLevels}
      showUkGranularityOption={showUkGranularityOption}
      showViewDetailsCta={showViewDetailsCta}
      showCatchmentAction={showCatchmentAction}
      mapControlsSide={mapControlsSide}
      fullscreenBrandMode={fullscreenBrandMode}
      mapId={mapId}
    />
  )

  return (
    <TooltipProvider>
      {/* Normal mode: Card wrapper */}
      {!isFullscreen && (
        <Card className={cn("relative overflow-hidden h-full flex flex-col !p-0 !m-0 !py-0", className)}>
          {!hideHeader && (
            <CardHeader className="flex-shrink-0 px-4 pt-4 pb-1">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Regional Map
            </div>
                <Badge variant="outline" className="text-xs">
                  {year} • {scenario}
                </Badge>
              </CardTitle>
              {headerSubtitle ? (
                <div className="text-base font-medium text-foreground/85 mt-0.5">
                  {headerSubtitle}
                </div>
              ) : null}
            </CardHeader>
          )}

          <CardContent className="!p-0 !m-0 !px-0 flex-1 min-h-0">
            {/* Normal mode container: explicit height, no padding at all */}
            <div className="relative w-full h-full" style={{ padding: "0", margin: "0" }}>
              {mapContent}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Fullscreen mode: portal to body, completely outside Card hierarchy */}
      {isFullscreen &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-background overflow-hidden"
            style={{
              width: "100%",
              height: "100%",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {mapContent}
          </div>,
          document.body
        )}
    </TooltipProvider>
  )
}

MapScaffold.Skeleton = function MapScaffoldSkeleton() {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[450px] bg-muted/20 animate-pulse" />
        <div className="p-4 border-t bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-4 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
