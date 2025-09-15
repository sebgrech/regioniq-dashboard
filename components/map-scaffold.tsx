"use client"

import { useState } from "react"
import { Map, useMap } from "@vis.gl/react-mapbox"
import "mapbox-gl/dist/mapbox-gl.css"

import { ZoomIn, ZoomOut, Maximize, Layers, Info, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { REGIONS } from "@/lib/metrics.config"

// 👇 import the dynamic overlay you just finished
import { MapOverlaysDynamic } from "@/components/map-overlays-dynamic"

interface MapScaffoldProps {
  selectedRegion: string
  metric: string
  year: number
  scenario: string
  onRegionSelect?: (regionCode: string) => void
  className?: string
}

/** Controls rendered INSIDE <Map> so useMap("default") is valid */
function MapControls({
  showLayers,
  setShowLayers,
  isFullscreen,
  setIsFullscreen,
}: {
  showLayers: boolean
  setShowLayers: (v: boolean) => void
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
}) {
  const { current: map } = useMap("default")

  const handleZoomIn = () => {
    const z = map?.getZoom() ?? 5
    map?.zoomTo(Math.min(z + 1, 12), { duration: 250 })
  }

  const handleZoomOut = () => {
    const z = map?.getZoom() ?? 5
    map?.zoomTo(Math.max(z - 1, 3), { duration: 250 })
  }

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1]">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm" onClick={handleZoomIn} className="h-8 w-8 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom In</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" size="sm" onClick={handleZoomOut} className="h-8 w-8 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom Out</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLayers(!showLayers)}
            className="h-8 w-8 p-0"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{showLayers ? "Hide ITL1" : "Show ITL1"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8 p-0"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fullscreen</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function MapScaffold({
  selectedRegion,
  metric,
  year,
  scenario,
  onRegionSelect,
  className,
}: MapScaffoldProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showLayers, setShowLayers] = useState(true)

  const region = REGIONS.find((r) => r.code === selectedRegion)

  return (
    <TooltipProvider>
      <Card className={cn("relative overflow-hidden", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Regional Map
            </div>
            <Badge variant="outline" className="text-xs">
              {year} • {scenario}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className={cn("relative h-[450px]", isFullscreen && "fixed inset-4 z-50 rounded-xl shadow-2xl")}>
            <Map
              id="default" // REQUIRED so useMap("default") resolves
              mapLib={import("mapbox-gl")}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              initialViewState={{ longitude: -2, latitude: 54.5, zoom: 5 }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/light-v11"
            >
              {/* ✅ Dynamic overlay that fetches Supabase + decorates GeoJSON in-memory */}
              <MapOverlaysDynamic
                show={showLayers}
                metric={metric}
                year={year}
                scenario={scenario}
                onRegionSelect={onRegionSelect}
              />

              {/* ✅ Controls live inside <Map> so they can use useMap("default") */}
              <MapControls
                showLayers={showLayers}
                setShowLayers={setShowLayers}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
              />
            </Map>

            {/* Selected Region Info (optional) */}
            {region && (
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

          {/* Legend */}
          <div className="p-4 border-t bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Legend</span>
              <span className="text-xs text-muted-foreground">
                {showLayers ? "ITL1 regions visible" : "Base map only"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Region values</span>
              <div className="flex-1 h-4 rounded-full overflow-hidden bg-purple-400/50 border border-purple-900" />
            </div>
          </div>
        </CardContent>
      </Card>
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
