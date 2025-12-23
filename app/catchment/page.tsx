"use client"

/**
 * Catchment Analysis Page
 * 
 * Allows users to draw catchment areas (circles or polygons) on the map
 * and instantly see aggregated population, income, and employment metrics.
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Map } from "@vis.gl/react-mapbox"
import { Source, Layer } from "@vis.gl/react-mapbox"
import { Loader2, ArrowLeft, Map as MapIcon, Info, Layers, Sun, Moon, Satellite, MapPinned } from "lucide-react"
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

import "mapbox-gl/dist/mapbox-gl.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"

import { useGeofence } from "@/hooks/use-geofence"
import { GeofenceDrawControls } from "@/components/geofence-draw-controls"
import { GeofenceResults } from "@/components/geofence-results"
import { MapboxDrawControl } from "@/components/mapbox-draw-control"
import type { Polygon, MultiPolygon } from "geojson"

// Stable mapbox lib reference to prevent re-initialization
const MAPBOX_LIB = import("mapbox-gl")

const MAP_ID = "catchment-map"

// Map style options
type MapStyleOption = "auto" | "light" | "dark" | "streets" | "satellite" | "satellite-streets"

const MAP_STYLES: Record<string, { url: string; label: string; icon: typeof MapIcon }> = {
  light: { url: "mapbox://styles/mapbox/light-v11", label: "Light", icon: Sun },
  dark: { url: "mapbox://styles/mapbox/dark-v11", label: "Dark", icon: Moon },
  streets: { url: "mapbox://styles/mapbox/streets-v12", label: "Streets", icon: MapPinned },
  satellite: { url: "mapbox://styles/mapbox/satellite-v9", label: "Satellite", icon: Satellite },
  "satellite-streets": { url: "mapbox://styles/mapbox/satellite-streets-v12", label: "Hybrid", icon: Layers },
}

function CatchmentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()

  // URL state
  const yearParam = searchParams?.get("year")
  const scenarioParam = searchParams?.get("scenario")
  const [year, setYear] = useState(yearParam ? parseInt(yearParam) : 2024)
  const [scenario, setScenario] = useState<Scenario>(
    (scenarioParam as Scenario) || "baseline"
  )
  const [circleRadius, setCircleRadius] = useState(10) // km
  const [mapStyleOption, setMapStyleOption] = useState<MapStyleOption>("auto")
  const [mounted, setMounted] = useState(false)

  // Track mount state for hydration
  useEffect(() => setMounted(true), [])

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
    autoCalculate: true,
    onResult: (result) => {
      if (result && result.regions_used > 0) {
        toast({
          title: "Catchment calculated",
          description: `${result.regions_used} local authorities • ${Math.round(result.population).toLocaleString()} people`,
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

  // Update URL when year/scenario changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (year !== 2024) params.set("year", String(year))
    if (scenario !== "baseline") params.set("scenario", scenario)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : "/catchment", { scroll: false })
  }, [year, scenario, router])

  // Get the drawn polygon for visualization (if any)
  const drawnPolygon = geofenceState.geofence?.polygon

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
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="h-8 px-3">
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
          {/* Year selector */}
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
                  { length: YEARS.max - YEARS.min + 1 },
                  (_, i) => YEARS.min + i
                ).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scenario selector */}
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
                          Values are area-weighted estimates based on LAD
                          boundaries.
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
                      {geofenceState.result.regions_used} LADs
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

