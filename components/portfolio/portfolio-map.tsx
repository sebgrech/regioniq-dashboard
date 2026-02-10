"use client"

/**
 * Portfolio map with:
 * - Full LAD GeoJSON boundaries (background: faint grey, foreground: asset-colored)
 * - Pin markers on top of shaded regions
 * - Toggleable boundary layer
 * - Card ↔ map bidirectional hover highlight
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useTheme } from "next-themes"
import {
  Map as MapboxMap,
  Source,
  Layer,
  Marker,
  NavigationControl,
} from "@vis.gl/react-mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { MapPin, Loader2, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PortfolioAssetItem, GeocodedAsset } from "./portfolio-types"
import { ASSET_COLORS, shortAddress } from "./portfolio-types"

// Stable mapbox lib reference (prevents re-initialization)
const MAPBOX_LIB = import("mapbox-gl")

// LAD GeoJSON CDN / local paths (same as map-overlays-dynamic.tsx)
function getLadGeoJsonUrl(): string {
  const useCDN =
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_USE_CDN !== "false"
  if (useCDN) {
    return "https://pub-aad6b4b085f8487dbfe1151db5bb3751.r2.dev/boundaries/LAD.geojson"
  }
  return "/boundaries/LAD.geojson"
}

// LAD GeoJSON property key for region codes
const LAD_CODE_PROP = "LAD24CD"

interface PortfolioMapProps {
  assets: PortfolioAssetItem[]
  geocodedAssets: GeocodedAsset[]
  visible: boolean[]
  mapLoading: boolean
  mapRef: React.MutableRefObject<any>
  fitMapBounds: (map: any, points: GeocodedAsset[]) => void
  toggleAsset: (index: number) => void
  hoveredAssetIndex: number | null
  onAssetHover: (index: number | null) => void
}

export function PortfolioMap({
  assets,
  geocodedAssets,
  visible,
  mapLoading,
  mapRef,
  fitMapBounds,
  toggleAsset,
  hoveredAssetIndex,
  onAssetHover,
}: PortfolioMapProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const mapStyle = isDarkMode
    ? "mapbox://styles/mapbox/navigation-night-v1"
    : "mapbox://styles/mapbox/streets-v12"

  // ---- LAD boundary state ----
  const [ladGeoData, setLadGeoData] =
    useState<GeoJSON.FeatureCollection | null>(null)
  const [showBoundaries, setShowBoundaries] = useState(true)
  const ladFetchedRef = useRef(false)

  // Default center
  const defaultCenter = useMemo(() => {
    if (geocodedAssets.length > 0) {
      return { lat: geocodedAssets[0].lat, lng: geocodedAssets[0].lng }
    }
    return { lat: 53.5, lng: -1.5 }
  }, [geocodedAssets])

  // ---- Fetch LAD GeoJSON once ----
  useEffect(() => {
    if (ladFetchedRef.current) return
    ladFetchedRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        const url = getLadGeoJsonUrl()
        const res = await fetch(url)
        if (!res.ok) throw new Error(`LAD fetch failed: ${res.status}`)
        const data = (await res.json()) as GeoJSON.FeatureCollection
        if (!cancelled) setLadGeoData(data)
      } catch {
        // Try local fallback
        try {
          const res = await fetch("/boundaries/LAD.geojson")
          if (!res.ok) return
          const data = (await res.json()) as GeoJSON.FeatureCollection
          if (!cancelled) setLadGeoData(data)
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Portfolio LAD codes set ----
  const portfolioCodes = useMemo(
    () => new Set(assets.map((a) => a.region_code)),
    [assets]
  )

  // ---- Mapbox style expressions for LAD boundaries ----
  // Build a "match" expression: [match, [get, LAD24CD], code1, color1, code2, color2, ..., fallback]
  const fillColorExpr = useMemo(() => {
    const entries: (string | string[])[] = []
    assets.forEach((a, i) => {
      entries.push(a.region_code)
      entries.push(ASSET_COLORS[i % ASSET_COLORS.length])
    })
    return ["match", ["get", LAD_CODE_PROP], ...entries, "#94a3b8"] as any
  }, [assets])

  const lineColorExpr = useMemo(() => {
    const entries: string[] = []
    assets.forEach((a, i) => {
      entries.push(a.region_code)
      entries.push(ASSET_COLORS[i % ASSET_COLORS.length])
    })
    return ["match", ["get", LAD_CODE_PROP], ...entries, "#cbd5e1"] as any
  }, [assets])

  // Codes as a literal array for the "in" expression
  const codesLiteral = useMemo(
    () => Array.from(portfolioCodes),
    [portfolioCodes]
  )

  // Hovered asset's region code (for map highlight)
  const hoveredCode =
    hoveredAssetIndex != null ? assets[hoveredAssetIndex]?.region_code : null

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden border border-border/40">
      {mapLoading ? (
        <div className="w-full h-full bg-muted/30 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading map...</span>
          </div>
        </div>
      ) : geocodedAssets.length === 0 ? (
        <div className="w-full h-full bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Map unavailable</p>
          </div>
        </div>
      ) : (
        <MapboxMap
          ref={mapRef}
          mapLib={MAPBOX_LIB}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{
            latitude: defaultCenter.lat,
            longitude: defaultCenter.lng,
            zoom: 5.5,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          attributionControl={false}
          logoPosition="bottom-right"
          onLoad={(evt) => {
            if (geocodedAssets.length > 0) {
              fitMapBounds(evt.target, geocodedAssets)
            }
          }}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {/* ---- LAD boundary layers ---- */}
          {showBoundaries && ladGeoData && (
            <Source id="portfolio-lad-src" type="geojson" data={ladGeoData}>
              {/* Background: all LADs faint grey */}
              <Layer
                id="portfolio-lad-bg-fill"
                type="fill"
                paint={{
                  "fill-color": "#94a3b8",
                  "fill-opacity": isDarkMode ? 0.04 : 0.05,
                }}
              />
              <Layer
                id="portfolio-lad-bg-line"
                type="line"
                paint={{
                  "line-color": isDarkMode ? "#334155" : "#cbd5e1",
                  "line-width": 0.4,
                  "line-opacity": 0.3,
                }}
              />

              {/* Foreground: portfolio LADs colored */}
              <Layer
                id="portfolio-lad-fg-fill"
                type="fill"
                filter={["in", ["get", LAD_CODE_PROP], ["literal", codesLiteral]]}
                paint={{
                  "fill-color": fillColorExpr,
                  "fill-opacity": [
                    "case",
                    // Hovered asset's region gets brighter
                    hoveredCode
                      ? (["==", ["get", LAD_CODE_PROP], hoveredCode] as any)
                      : false,
                    0.45,
                    0.25,
                  ],
                }}
              />
              <Layer
                id="portfolio-lad-fg-line"
                type="line"
                filter={["in", ["get", LAD_CODE_PROP], ["literal", codesLiteral]]}
                paint={{
                  "line-color": lineColorExpr,
                  "line-width": [
                    "case",
                    hoveredCode
                      ? (["==", ["get", LAD_CODE_PROP], hoveredCode] as any)
                      : false,
                    3.5,
                    2,
                  ],
                  "line-opacity": 0.85,
                }}
              />
            </Source>
          )}

          {/* ---- Pin markers (always on top) ---- */}
          {geocodedAssets.map((geo) => {
            const assetIndex = assets.findIndex((a) => a.id === geo.assetId)
            if (assetIndex === -1) return null
            const asset = assets[assetIndex]
            const color = ASSET_COLORS[assetIndex % ASSET_COLORS.length]
            const isVisible = visible[assetIndex]
            const isHovered = hoveredAssetIndex === assetIndex

            return (
              <Marker
                key={geo.assetId}
                latitude={geo.lat}
                longitude={geo.lng}
                anchor="bottom"
                onClick={() => toggleAsset(assetIndex)}
              >
                <div
                  className="relative group cursor-pointer"
                  onMouseEnter={() => onAssetHover(assetIndex)}
                  onMouseLeave={() => onAssetHover(null)}
                >
                  {/* Pin */}
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg transition-all",
                      isVisible ? "scale-100" : "scale-75 opacity-50",
                      isHovered && "scale-110 ring-2 ring-white/60"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  {/* Tooltip on hover */}
                  <div
                    className={cn(
                      "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 transition-opacity pointer-events-none z-20",
                      isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
                      <p className="text-xs font-medium text-foreground">
                        {shortAddress(asset.address, 35)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {asset.region_name}
                      </p>
                    </div>
                  </div>
                </div>
              </Marker>
            )
          })}
        </MapboxMap>
      )}

      {/* Boundary toggle button */}
      {!mapLoading && geocodedAssets.length > 0 && (
        <button
          className={cn(
            "absolute bottom-3 left-3 z-10 p-2 rounded-lg border shadow-md transition-all",
            showBoundaries
              ? "bg-primary/90 border-primary text-primary-foreground"
              : "bg-background/80 backdrop-blur-sm border-border/60 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setShowBoundaries((p) => !p)}
          title={showBoundaries ? "Hide boundaries" : "Show LAD boundaries"}
        >
          <Layers className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
