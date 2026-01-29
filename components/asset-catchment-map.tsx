"use client"

/**
 * AssetCatchmentMap
 * 
 * Interactive map component for GP asset pages that allows users to draw
 * catchment areas (circles/polygons) and see aggregated economic metrics.
 * Replaces the static AssetLocationMap with full drawing capabilities.
 */

import { useEffect, useState, useRef, useCallback } from "react"
import { Map, Marker, NavigationControl, useMap } from "@vis.gl/react-mapbox"
import { useTheme } from "next-themes"
import { MapPin, Loader2, Circle, Pentagon, Trash2, Pencil } from "lucide-react"
import type { Polygon, MultiPolygon } from "geojson"
import type { Scenario } from "@/lib/metrics.config"
import { useGeofence } from "@/hooks/use-geofence"
import { MapboxDrawControl } from "@/components/mapbox-draw-control"
import { GeofenceResultsInline } from "@/components/geofence-results"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import "mapbox-gl/dist/mapbox-gl.css"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import MapboxDraw from "@mapbox/mapbox-gl-draw"

// Stable mapbox lib reference to prevent re-initialization
const MAPBOX_LIB = import("mapbox-gl")

const MAP_ID = "asset-catchment-map"

/**
 * Internal component that clears draw shapes - must be inside Map context
 */
function DrawClearer({ 
  shouldClear, 
  onCleared 
}: { 
  shouldClear: boolean
  onCleared: () => void 
}) {
  const maps = useMap() as any
  const mapRef = maps?.[MAP_ID] ?? maps?.default ?? maps?.current
  const mapbox = mapRef?.getMap?.() ?? mapRef

  useEffect(() => {
    if (!shouldClear || !mapbox) return

    // Find and clear the draw control
    const controls = (mapbox as any)._controls || []
    for (const control of controls) {
      if (control instanceof MapboxDraw) {
        control.deleteAll()
        control.changeMode("simple_select")
        break
      }
    }
    onCleared()
  }, [shouldClear, mapbox, onCleared])

  return null
}

interface AssetCatchmentMapProps {
  postcode?: string | null
  address?: string
  year: number
  scenario: Scenario
  className?: string
}

interface GeocodedLocation {
  lat: number
  lng: number
  placeName: string
}

export function AssetCatchmentMap({ 
  postcode, 
  address, 
  year,
  scenario,
  className 
}: AssetCatchmentMapProps) {
  const { theme } = useTheme()
  const [location, setLocation] = useState<GeocodedLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [circleRadius, setCircleRadius] = useState(5) // Default 5km for asset-level
  const [isCirclePopoverOpen, setIsCirclePopoverOpen] = useState(false)
  const [shouldClearDraw, setShouldClearDraw] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const mapRef = useRef<any>(null)
  
  // Geofence state management
  const {
    state: geofenceState,
    setMode,
    setGeofenceFromPolygon,
    clear,
    preload,
  } = useGeofence({
    year,
    scenario,
    autoCalculate: true,
  })
  
  // Handle clear with draw shape removal
  const handleClear = useCallback(() => {
    setShouldClearDraw(true)
    clear()
  }, [clear])
  
  // Called after draw shapes are cleared
  const handleDrawCleared = useCallback(() => {
    setShouldClearDraw(false)
  }, [])
  
  // Hide hint after first interaction or after delay
  useEffect(() => {
    if (geofenceState.geofence || geofenceState.isDrawing) {
      setShowHint(false)
    }
  }, [geofenceState.geofence, geofenceState.isDrawing])
  
  // Auto-hide hint after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])
  
  // Preload LAD GeoJSON on mount for faster calculations
  useEffect(() => {
    preload()
  }, [preload])
  
  // Geocode the postcode or address on mount
  useEffect(() => {
    async function geocodeLocation() {
      if (!postcode && !address) {
        setError("No location provided")
        setIsLoading(false)
        return
      }
      
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) {
          setError("Map configuration missing")
          setIsLoading(false)
          return
        }
        
        const searchQuery = postcode 
          ? `${postcode}, United Kingdom`
          : `${address}, United Kingdom`
        const query = encodeURIComponent(searchQuery)
        const types = postcode ? "postcode,address" : "address,place,poi"
        
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=GB&types=${types}&limit=1`
        )
        
        if (!response.ok) {
          throw new Error("Geocoding failed")
        }
        
        const data = await response.json()
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center
          setLocation({
            lat,
            lng,
            placeName: data.features[0].place_name,
          })
        } else {
          setError("Location not found")
        }
      } catch (err) {
        console.error("Geocoding error:", err)
        setError("Unable to load map")
      } finally {
        setIsLoading(false)
      }
    }
    
    geocodeLocation()
  }, [postcode, address])
  
  // Handle draw completion
  const handleDrawComplete = useCallback((
    polygon: Polygon | MultiPolygon,
    mode: "circle" | "polygon"
  ) => {
    setGeofenceFromPolygon(polygon, mode)
  }, [setGeofenceFromPolygon])
  
  // Handle draw cancel
  const handleDrawCancel = useCallback(() => {
    setMode("none")
  }, [setMode])
  
  // Handle polygon button click
  const handlePolygonClick = () => {
    if (geofenceState.mode === "polygon") {
      setMode("none")
    } else {
      setMode("polygon")
    }
  }
  
  // Handle circle confirm
  const handleCircleConfirm = () => {
    setIsCirclePopoverOpen(false)
    setMode("circle")
  }
  
  // Map style based on theme
  const mapStyle = theme === "dark" 
    ? "mapbox://styles/mapbox/navigation-night-v1"
    : "mapbox://styles/mapbox/streets-v12"
  
  const hasGeofence = !!geofenceState.geofence
  const isDrawing = geofenceState.isDrawing
  const isCalculating = geofenceState.isCalculating
  
  // Loading state
  if (isLoading) {
    return (
      <div className={cn("relative rounded-xl overflow-hidden bg-muted/30", className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error || !location) {
    return (
      <div className={cn("relative rounded-xl overflow-hidden bg-muted/30", className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error || "Map unavailable"}</p>
            {postcode && (
              <p className="text-xs mt-1 opacity-70">{postcode}</p>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("relative rounded-xl overflow-hidden", className)}>
      <Map
        id={MAP_ID}
        ref={mapRef}
        mapLib={MAPBOX_LIB}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: location.lat,
          longitude: location.lng,
          zoom: 13,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        attributionControl={false}
        logoPosition="bottom-right"
        onLoad={() => setMapReady(true)}
      >
        {/* Navigation controls */}
        <NavigationControl position="top-right" showCompass={false} />
        
        {/* Mapbox Draw Control for polygon/circle drawing */}
        {mapReady && (
          <>
            <MapboxDrawControl
              mode={geofenceState.mode}
              mapId={MAP_ID}
              circleRadiusKm={circleRadius}
              onDrawComplete={handleDrawComplete}
              onDrawCancel={handleDrawCancel}
            />
            <DrawClearer 
              shouldClear={shouldClearDraw} 
              onCleared={handleDrawCleared} 
            />
          </>
        )}
        
        {/* Asset marker */}
        <Marker
          latitude={location.lat}
          longitude={location.lng}
          anchor="bottom"
        >
          <div className="relative group">
            {/* Pulse animation */}
            <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
            
            {/* Main pin */}
            <div className="relative flex items-center justify-center w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                <p className="text-xs font-medium text-foreground">{postcode || address}</p>
                {postcode && address && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
                    {address}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Marker>
      </Map>
      
      {/* Draw Controls Overlay - Top Left */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-1.5 shadow-sm">
          {/* Draw Polygon button */}
          <Button
            variant={geofenceState.mode === "polygon" ? "default" : "ghost"}
            size="sm"
            onClick={handlePolygonClick}
            disabled={!mapReady || isCalculating}
            className={cn(
              "h-7 w-7 p-0",
              geofenceState.mode === "polygon" && "ring-1 ring-primary"
            )}
            title="Draw polygon catchment"
          >
            <Pentagon className="h-3.5 w-3.5" />
          </Button>

          {/* Draw Circle button with radius popover */}
          <Popover open={isCirclePopoverOpen} onOpenChange={setIsCirclePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={geofenceState.mode === "circle" ? "default" : "ghost"}
                size="sm"
                disabled={!mapReady || isCalculating}
                className={cn(
                  "h-7 w-7 p-0",
                  geofenceState.mode === "circle" && "ring-1 ring-primary"
                )}
                title="Draw circle catchment"
              >
                <Circle className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start" side="bottom">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-xs mb-0.5">Circle Radius</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Set the radius for your catchment
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Radius:</span>
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                      {circleRadius} km
                    </Badge>
                  </div>
                  <Slider
                    value={[circleRadius]}
                    onValueChange={([value]) => setCircleRadius(value)}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>1 km</span>
                    <span>50 km</span>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setIsCirclePopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={handleCircleConfirm}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Draw
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Clear button */}
          {hasGeofence && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isCalculating}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Clear catchment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        
        {/* Status indicator */}
        {(isDrawing || isCalculating || geofenceState.error) && (
          <div className="flex items-center">
            {isDrawing && (
              <Badge variant="outline" className="bg-background/90 backdrop-blur-sm text-[10px] px-2 py-0.5">
                <Pencil className="h-2.5 w-2.5 mr-1" />
                {geofenceState.mode === "circle" ? "Click to place" : "Click to draw"}
              </Badge>
            )}
            {isCalculating && (
              <Badge variant="outline" className="bg-background/90 backdrop-blur-sm text-[10px] px-2 py-0.5">
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                Calculating...
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Results Overlay - Bottom */}
      {(geofenceState.result || isCalculating) && (
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-sm">
            <GeofenceResultsInline
              result={geofenceState.result}
              isCalculating={isCalculating}
            />
          </div>
        </div>
      )}
      
      {/* Location badge overlay - only show when no results */}
      {!geofenceState.result && !isCalculating && (
        <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm max-w-[200px]">
          <p className="text-xs font-medium text-foreground truncate">{postcode || address}</p>
        </div>
      )}
      
      {/* Tour-style hint card - positioned to the right of draw controls */}
      {showHint && !hasGeofence && !isDrawing && !isCalculating && mapReady && (
        <div 
          className="absolute z-20 animate-in fade-in-0 zoom-in-95 duration-300 flex items-start"
          style={{
            top: 12,
            left: 85,
          }}
        >
          {/* Arrow pointing left to controls */}
          <div className="flex items-center h-10 -mr-1">
            <div 
              className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-background/92"
              style={{ filter: "drop-shadow(-1px 0 1px rgba(0,0,0,0.05))" }}
            />
          </div>
          
          {/* Card with tour styling - more rectangular */}
          <div
            className="rounded-xl border border-border/60 bg-background/92 backdrop-blur-xl px-3 py-2"
            style={{
              boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
              animation: "riq-hintFloat 3.2s ease-in-out infinite",
              maxWidth: 180,
            }}
          >
            <div className="flex items-start gap-2">
              <Pencil className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold leading-tight text-foreground">
                  Draw a catchment
                </div>
                <div className="text-[10px] text-muted-foreground leading-snug">
                  Click to see local metrics
                </div>
              </div>
              <button 
                className="shrink-0 ml-1 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHint(false)}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom animation styles */}
      <style jsx>{`
        @keyframes riq-hintFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}
