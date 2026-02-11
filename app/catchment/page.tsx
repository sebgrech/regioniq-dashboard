"use client"

/**
 * Catchment Analysis Page
 * 
 * Allows users to draw catchment areas (circles or polygons) on the map
 * and instantly see aggregated population, income, and employment metrics.
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Map, useMap } from "@vis.gl/react-mapbox"  // useMap used in FitToSourceRegion
import { Source, Layer } from "@vis.gl/react-mapbox"
import { Loader2, ArrowLeft, Map as MapIcon, Info, Layers, Sun, Moon, Satellite, MapPinned, Grid3X3 } from "lucide-react"
import type { FeatureCollection, Feature, Geometry } from "geojson"
import { useTheme } from "next-themes"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { YEARS, type Scenario } from "@/lib/metrics.config"
import type { CatchmentLevel } from "@/lib/geofence"
import { Switch } from "@/components/ui/switch"

import "mapbox-gl/dist/mapbox-gl.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"

import { useGeofence } from "@/hooks/use-geofence"
import { GeofenceDrawControls } from "@/components/geofence-draw-controls"
import { GeofenceResults } from "@/components/geofence-results"
import { MapboxDrawControl } from "@/components/mapbox-draw-control"
import { MapOverlaysDynamic } from "@/components/map-overlays-dynamic"
import type { Polygon, MultiPolygon } from "geojson"

// Stable mapbox lib reference to prevent re-initialization
const MAPBOX_LIB = import("mapbox-gl")

const MAP_ID = "catchment-map"
const REGION_KEY = "riq:last-region"

// Region level type
type RegionLevel = "UK" | "ITL1" | "ITL2" | "ITL3" | "LAD"

// Property name mapping for each level (matches map-overlays-dynamic.tsx)
const PROPERTY_MAP: Record<RegionLevel, { code: string; name: string }> = {
  UK: { code: "shapeISO", name: "shapeName" },
  ITL1: { code: "ITL125CD", name: "ITL125NM" },
  ITL2: { code: "ITL225CD", name: "ITL225NM" },
  ITL3: { code: "ITL325CD", name: "ITL325NM" },
  LAD: { code: "LAD24CD", name: "LAD24NM" },
}

// UK slug -> ITL125CD (TL*) for matching GeoJSON
const UK_TO_TL: Record<string, string> = {
  UKC: "TLC", UKD: "TLD", UKE: "TLE", UKF: "TLF", UKG: "TLG",
  UKH: "TLH", UKI: "TLI", UKJ: "TLJ", UKK: "TLK", UKL: "TLL",
  UKM: "TLM", UKN: "TLN",
}

interface RegionMetadata {
  code: string
  name: string
  level: RegionLevel
  bbox: [number, number, number, number]
}

// Map style options
type MapStyleOption = "auto" | "light" | "dark" | "streets" | "satellite" | "satellite-streets"

const MAP_STYLES: Record<string, { url: string; label: string; icon: typeof MapIcon }> = {
  light: { url: "mapbox://styles/mapbox/light-v11", label: "Light", icon: Sun },
  dark: { url: "mapbox://styles/mapbox/dark-v11", label: "Dark", icon: Moon },
  streets: { url: "mapbox://styles/mapbox/streets-v12", label: "Streets", icon: MapPinned },
  satellite: { url: "mapbox://styles/mapbox/satellite-v9", label: "Satellite", icon: Satellite },
  "satellite-streets": { url: "mapbox://styles/mapbox/satellite-streets-v12", label: "Hybrid", icon: Layers },
}

/** Component to fit map to source region bbox (must be inside Map component) */
function FitToSourceRegion({
  mapId,
  sourceRegion,
  onFitComplete,
}: {
  mapId: string
  sourceRegion: RegionMetadata | null
  onFitComplete?: () => void
}) {
  const maps = useMap() as any
  const mapRef = maps?.[mapId] ?? maps?.default ?? maps?.current
  const mapbox = mapRef?.getMap?.() ?? mapRef
  const didFitRef = useRef(false)

  useEffect(() => {
    if (!mapbox || !sourceRegion || didFitRef.current) return

    const bbox = sourceRegion.bbox
    if (bbox && bbox.length === 4) {
      mapbox.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 60, duration: 1000 }
      )
      didFitRef.current = true
      
      // Notify parent to start fade-out timer
      if (onFitComplete) {
        setTimeout(onFitComplete, 100) // Small delay to ensure animation starts
      }
    }
  }, [mapbox, sourceRegion, onFitComplete])

  return null
}

function CatchmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()

  // URL state
  const yearParam = searchParams?.get("year")
  const scenarioParam = searchParams?.get("scenario")
  const regionParam = searchParams?.get("region")
  const [year, setYear] = useState(yearParam ? parseInt(yearParam) : 2024)
  const [scenario, setScenario] = useState<Scenario>(
    (scenarioParam as Scenario) || "baseline"
  )
  const [circleRadius, setCircleRadius] = useState(10) // km
  const [catchmentLevel, setCatchmentLevel] = useState<CatchmentLevel>("MSOA")
  const [mapStyleOption, setMapStyleOption] = useState<MapStyleOption>("auto")
  const [choroplethMetric] = useState("population_total")
  const [showChoropleth, setShowChoropleth] = useState(true)

  // Year range and forecast availability per level
  const LEVEL_YEAR_CONFIG: Record<CatchmentLevel, { min: number; max: number; hasForecasts: boolean }> = {
    LAD:  { min: YEARS.min, max: YEARS.max, hasForecasts: true },
    MSOA: { min: YEARS.min, max: 2024,      hasForecasts: false },
  }
  const levelYearConfig = LEVEL_YEAR_CONFIG[catchmentLevel]
  const [mounted, setMounted] = useState(false)
  
  // Source region (from dashboard context)
  const [sourceRegion, setSourceRegion] = useState<RegionMetadata | null>(null)
  const [sourcePolygon, setSourcePolygon] = useState<Feature<Geometry> | null>(null)
  const [showSourceOutline, setShowSourceOutline] = useState(false)
  const outlineFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track mount state for hydration
  useEffect(() => setMounted(true), [])

  // Clamp year and reset scenario when switching catchment level
  useEffect(() => {
    if (year > levelYearConfig.max) {
      setYear(levelYearConfig.max)
    }
    if (!levelYearConfig.hasForecasts && scenario !== "baseline") {
      setScenario("baseline")
    }
  }, [catchmentLevel]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Load source region from URL param or localStorage
  useEffect(() => {
    let cancelled = false
    
    const loadSourceRegion = async () => {
      try {
        const regionCode = regionParam || (typeof window !== "undefined" ? localStorage.getItem(REGION_KEY) : null)
        if (!regionCode || regionCode === "UK") return // Skip UK level - too zoomed out
        
        // Fetch region metadata (has bbox and level)
        const indexRes = await fetch("/processed/region-index.json")
        if (!indexRes.ok) return
        
        const index = await indexRes.json()
        if (cancelled) return
        
        const meta = index?.[regionCode]
        if (!meta?.bbox || !meta?.level) return
        
        setSourceRegion({
          code: regionCode,
          name: meta.name || regionCode,
          level: meta.level as RegionLevel,
          bbox: meta.bbox,
        })
        
        // Fetch the polygon geometry from the appropriate GeoJSON
        const level = meta.level as RegionLevel
        const geoPath = `/boundaries/${level}.geojson`
        const geoRes = await fetch(geoPath)
        if (!geoRes.ok || cancelled) return
        
        const geoData: FeatureCollection = await geoRes.json()
        if (cancelled || !geoData?.features) return
        
        // Find the matching feature
        const propMap = PROPERTY_MAP[level]
        if (!propMap) return
        
        // For ITL1, we need to map UK* codes to TL* codes
        const matchCode = level === "ITL1" ? (UK_TO_TL[regionCode] || regionCode) : regionCode
        
        const feature = geoData.features.find((f) => {
          const featureCode = (f.properties as any)?.[propMap.code]
          return featureCode === matchCode || featureCode === regionCode
        })
        
        if (feature && !cancelled) {
          setSourcePolygon(feature as Feature<Geometry>)
          setShowSourceOutline(true)
        }
      } catch (error) {
        // Silently fail - this is just a nice-to-have feature
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to load source region:", error)
        }
      }
    }
    
    loadSourceRegion()
    
    return () => {
      cancelled = true
    }
  }, [regionParam])

  // Compute the actual map style URL
  const mapStyleUrl = (() => {
    if (mapStyleOption === "auto") {
      // Auto mode: follow system theme
      const themeStyle = mounted && resolvedTheme === "dark" ? "dark" : "light"
      return MAP_STYLES[themeStyle].url
    }
    return MAP_STYLES[mapStyleOption].url
  })()

  // Geofence hook
  const {
    state: geofenceState,
    setMode,
    setGeofenceFromPolygon,
    setGeofenceFromCircle,
    clear,
    preload,
  } = useGeofence({
    year,
    scenario,
    level: catchmentLevel,
    autoCalculate: true,
    onResult: (result) => {
      if (result && result.regions_used > 0) {
        const regionLabel = result.level === "MSOA" ? "neighbourhoods" : "local authorities"
        toast({
          title: "Catchment calculated",
          description: `${result.regions_used} ${regionLabel} • ${Math.round(result.population).toLocaleString()} people`,
        })
      }
    },
    onError: (error) => {
      toast({
        title: "Calculation error",
        description: error,
        variant: "destructive",
      })
    },
  })

  // Map ready state
  const [isMapReady, setIsMapReady] = useState(false)
  
  // Callback when map fits to source region - start fade-out timer
  const handleFitComplete = useCallback(() => {
    if (showSourceOutline) {
      outlineFadeTimeoutRef.current = setTimeout(() => {
        setShowSourceOutline(false)
      }, 1500)
    }
  }, [showSourceOutline])
  
  // Cleanup fade timer on unmount
  useEffect(() => {
    return () => {
      if (outlineFadeTimeoutRef.current) {
        clearTimeout(outlineFadeTimeoutRef.current)
      }
    }
  }, [])

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default 320px (w-80)
  const isResizingRef = useRef(false)
  const minWidth = 280
  const maxWidth = 600

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // Preload LAD GeoJSON on mount
  useEffect(() => {
    preload()
  }, [preload])

  // Handle draw completion
  const handleDrawComplete = useCallback(
    (polygon: Polygon | MultiPolygon, mode: "circle" | "polygon") => {
      if (mode === "circle") {
        // For circles, we need the center - extract from the current state
        // The MapboxDrawControl handles this internally
        setGeofenceFromPolygon(polygon, "circle")
      } else {
        setGeofenceFromPolygon(polygon, "polygon")
      }
    },
    [setGeofenceFromPolygon]
  )

  // Handle mode change from draw controls
  const handleSetMode = useCallback(
    (mode: "circle" | "polygon" | "none") => {
      setMode(mode)
    },
    [setMode]
  )

  // Update URL when year/scenario changes (preserve region param)
  useEffect(() => {
    const params = new URLSearchParams()
    if (regionParam) params.set("region", regionParam)
    if (year !== 2024) params.set("year", String(year))
    if (scenario !== "baseline") params.set("scenario", scenario)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : "/catchment", { scroll: false })
  }, [year, scenario, regionParam, router])

  // Get the drawn polygon for visualization (if any)
  const drawnPolygon = geofenceState.geofence?.polygon
  const circleCenter = geofenceState.geofence?.mode === "circle"
    ? geofenceState.geofence.center
    : null

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - matches Analysis page layout */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-2 flex items-center justify-between">
          <div className="flex items-center">
            {/* Logo */}
            <div className="relative h-12 w-12 flex-shrink-0">
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
            </div>

            <div className="flex items-center gap-3 ml-3">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="h-8 px-3 cursor-pointer">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>

              <div className="h-8 w-px bg-border" />

              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MapIcon className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-lg font-semibold">Catchment Analysis</h1>
              </div>
            </div>
          </div>

        <div className="flex items-center gap-4">
          {/* Year selector — hidden for MSOA (always uses latest available per metric) */}
          {levelYearConfig.hasForecasts ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Year:</span>
              <Select
                value={String(year)}
                onValueChange={(v: string) => setYear(parseInt(v))}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: levelYearConfig.max - levelYearConfig.min + 1 },
                    (_, i) => levelYearConfig.min + i
                  ).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="secondary" className="h-8 px-3 text-xs font-medium">
              Latest data
            </Badge>
          )}

          {/* Scenario selector — only for levels with forecasts */}
          {levelYearConfig.hasForecasts && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Scenario:</span>
              <Select
                value={scenario}
                onValueChange={(v: string) => setScenario(v as Scenario)}
              >
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline</SelectItem>
                  <SelectItem value="upside">Upside</SelectItem>
                  <SelectItem value="downside">Downside</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <ThemeToggle />
        </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Resizable Sidebar */}
        <aside 
          className="border-r bg-card flex flex-col overflow-hidden relative"
          style={{ width: sidebarWidth, minWidth, maxWidth }}
        >
          <div className="p-4 border-b">
            <h2 className="font-semibold mb-3">Draw Catchment</h2>
            <GeofenceDrawControls
              state={geofenceState}
              onSetMode={handleSetMode}
              onClear={clear}
              isMapReady={isMapReady}
            />

            {/* Granularity toggle */}
            <div className="mt-3 p-2.5 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {catchmentLevel === "MSOA" ? "Neighbourhood" : "District"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {catchmentLevel === "MSOA" ? "High res" : "Standard"}
                  </span>
                  <Switch
                    checked={catchmentLevel === "MSOA"}
                    onCheckedChange={(checked) =>
                      setCatchmentLevel(checked ? "MSOA" : "LAD")
                    }
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {catchmentLevel === "MSOA"
                  ? "Latest available data per metric"
                  : "Historical & forecast (2010\u20132050)"}
              </p>
            </div>

            {/* Circle radius control (when in circle mode) */}
            {geofenceState.mode === "circle" && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Radius</span>
                  <Badge variant="secondary" className="font-mono">
                    {circleRadius} km
                  </Badge>
                </div>
                <Slider
                  value={[circleRadius]}
                  onValueChange={([v]) => setCircleRadius(v)}
                  min={1}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Click on the map to place your circle
                </p>
              </div>
            )}
          </div>

          {/* Results panel */}
          <div className="flex-1 overflow-auto p-4">
            <GeofenceResults
              result={geofenceState.result}
              isCalculating={geofenceState.isCalculating}
              error={geofenceState.error}
              geofence={geofenceState.geofence}
              compact
            />

            {/* Help text when no result */}
            {!geofenceState.result &&
              !geofenceState.isCalculating &&
              !geofenceState.error && (
                <Card className="mt-4 border-dashed">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                          <strong>How it works:</strong>
                        </p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Click "Draw Polygon" or "Draw Circle"</li>
                          <li>Draw your catchment area on the map</li>
                          <li>See instant population & economic data</li>
                        </ol>
                        <p className="text-xs">
                          Values are area-weighted estimates based on{" "}
                          {catchmentLevel === "MSOA" ? "neighbourhood" : "district"} boundaries.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Resize handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/10 active:bg-primary/20 transition-colors group flex items-center justify-center"
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-16 rounded-full bg-border group-hover:bg-primary group-hover:w-1 transition-all duration-150" />
          </div>
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <Map
            id={MAP_ID}
            mapLib={MAPBOX_LIB}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            initialViewState={{
              longitude: -2,
              latitude: 54.5,
              zoom: 5.5,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={mapStyleUrl}
            onLoad={() => setIsMapReady(true)}
          >
            {/* Fit to source region on load */}
            {isMapReady && sourceRegion && (
              <FitToSourceRegion
                mapId={MAP_ID}
                sourceRegion={sourceRegion}
                onFitComplete={handleFitComplete}
              />
            )}

            {/* Choropleth background — coloured regional data */}
            {isMapReady && showChoropleth && (
              <MapOverlaysDynamic
                show={true}
                metric={choroplethMetric}
                year={year}
                scenario={scenario}
                level="LAD"
                mapId={MAP_ID}
              />
            )}

            {/* Mapbox Draw control for polygon/circle drawing */}
            {isMapReady && (
              <MapboxDrawControl
                mode={geofenceState.mode}
                mapId={MAP_ID}
                circleRadiusKm={circleRadius}
                onDrawComplete={handleDrawComplete}
                onDrawCancel={() => setMode("none")}
              />
            )}

            {/* Source region outline (fades out after 1.5s) - "you came from here" hint */}
            {sourcePolygon && showSourceOutline && (
              <Source
                id="source-region-outline"
                type="geojson"
                data={sourcePolygon}
              >
                <Layer
                  id="source-region-outline-line"
                  type="line"
                  paint={{
                    "line-color": "#6366f1",
                    "line-width": 2.5,
                    "line-dasharray": [3, 2],
                    "line-opacity": 0.7,
                  }}
                />
              </Source>
            )}

            {/* Drawn geofence visualization (backup layer in case draw control doesn't show it) */}
            {drawnPolygon && (
              <Source
                id="geofence-drawn"
                type="geojson"
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: drawnPolygon,
                }}
              >
                <Layer
                  id="geofence-fill"
                  type="fill"
                  paint={{
                    "fill-color": "#3b82f6",
                    "fill-opacity": 0.15,
                  }}
                />
                <Layer
                  id="geofence-outline"
                  type="line"
                  paint={{
                    "line-color": "#2563eb",
                    "line-width": 3,
                  }}
                />
              </Source>
            )}

            {/* Circle center marker (for circle catchments) */}
            {circleCenter && (
              <Source
                id="geofence-circle-center"
                type="geojson"
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: circleCenter,
                  },
                }}
              >
                {/* subtle halo */}
                <Layer
                  id="geofence-circle-center-halo"
                  type="circle"
                  paint={{
                    "circle-radius": 10,
                    "circle-color": "#f97316",
                    "circle-opacity": 0.25,
                  }}
                />
                {/* crisp center dot */}
                <Layer
                  id="geofence-circle-center-dot"
                  type="circle"
                  paint={{
                    "circle-radius": 5,
                    "circle-color": "#ffffff",
                    "circle-stroke-color": "#f97316",
                    "circle-stroke-width": 2,
                  }}
                />
              </Source>
            )}

            {/* Contributing LADs highlight (when we have results) */}
            {geofenceState.result &&
              geofenceState.result.breakdown.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-lg border px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-500" />
                    <span className="text-muted-foreground">
                      Catchment area
                    </span>
                    <Badge variant="secondary" className="font-mono">
                      {geofenceState.result.regions_used}{" "}
                      {geofenceState.result.level === "MSOA" ? "neighbourhoods" : "LADs"}
                    </Badge>
                  </div>
                </div>
              )}
          </Map>

          {/* Map loading overlay */}
          {!isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading map...</span>
              </div>
            </div>
          )}

          {/* Map style selector */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-card/95 backdrop-blur rounded-lg border shadow-lg p-1.5">
              <div className="flex items-center gap-1">
                {/* Auto mode button */}
                <Button
                  variant={mapStyleOption === "auto" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setMapStyleOption("auto")}
                  title="Auto (follows theme)"
                >
                  {resolvedTheme === "dark" ? (
                    <Moon className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 mr-1" />
                  )}
                  Auto
                </Button>

                <div className="w-px h-5 bg-border mx-0.5" />

                {/* Style buttons */}
                {Object.entries(MAP_STYLES).map(([key, { label, icon: Icon }]) => (
                  <Button
                    key={key}
                    variant={mapStyleOption === key ? "default" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setMapStyleOption(key as MapStyleOption)}
                    title={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}

export default function CatchmentPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading Catchment Analysis...</span>
          </div>
        </div>
      }
    >
      <CatchmentContent />
    </Suspense>
  )
}

