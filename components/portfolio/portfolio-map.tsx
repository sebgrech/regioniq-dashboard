"use client"

/**
 * Portfolio map with:
 * - Full LAD GeoJSON boundaries (background: faint grey, foreground: asset-colored)
 * - Pin markers on top of shaded regions
 * - Toggleable boundary layer
 * - Card ↔ map bidirectional hover highlight
 * - Fullscreen mode via createPortal (mirrors map-scaffold.tsx pattern)
 */

import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "next-themes"
import {
  Map as MapboxMap,
  Source,
  Layer,
  Marker,
  NavigationControl,
} from "@vis.gl/react-mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { ArrowLeft, MapPin, Loader2, Layers, Maximize, X } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { PortfolioAssetItem, GeocodedAsset, RegionSignals } from "./portfolio-types"
import { ASSET_COLORS, METRICS, shortAddress, getAssetClassIcon } from "./portfolio-types"
import { MapOverlaysDynamic } from "@/components/map-overlays-dynamic"
import { CompanyLogo } from "@/components/company-logo"
import { Slider } from "@/components/ui/slider"
import { YEARS } from "@/lib/metrics.config"

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
  signalsMap: Record<string, RegionSignals>
  /** For choropleth in fullscreen mode */
  selectedMetric: string
  setSelectedMetric: (id: string) => void
  baseYear: number
  /** Owner name for company logo in fullscreen toolbar */
  ownerFilter?: string | null
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
  signalsMap,
  selectedMetric,
  setSelectedMetric,
  ownerFilter,
  baseYear,
}: PortfolioMapProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const mapStyle = isDarkMode
    ? "mapbox://styles/mapbox/navigation-night-v1"
    : "mapbox://styles/mapbox/streets-v12"

  // ---- Fullscreen state ----
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChoropleth, setShowChoropleth] = useState(true)
  const [choroplethYear, setChoroplethYear] = useState(baseYear)

  // Portfolio LAD codes — used to mask the choropleth (portfolio at full opacity, rest faded)
  const maskCodes = useMemo(() => assets.map((a) => a.region_code), [assets])

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [isFullscreen])

  // Escape key to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isFullscreen])

  // Resize map when entering/exiting fullscreen
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // Small delay to let the portal render before resize
    const t = setTimeout(() => {
      map.resize()
      if (geocodedAssets.length > 0) {
        fitMapBounds(map, geocodedAssets)
      }
    }, 100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

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

  // ===========================================================================
  // Map content (shared between inline and fullscreen)
  // ===========================================================================
  const mapContent = (
    <>
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

          {/* ---- Fullscreen choropleth overlay (all LADs shaded by metric) ---- */}
          {isFullscreen && showChoropleth && (
            <MapOverlaysDynamic
              show={true}
              metric={selectedMetric}
              year={choroplethYear}
              scenario="baseline"
              level="LAD"
              mapMode="value"
              maskRegionCodes={maskCodes}
              mapId="default"
            />
          )}

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
                  className="relative group cursor-pointer animate-pin-drop"
                  style={{ animationDelay: `${assetIndex * 120}ms` }}
                  onMouseEnter={() => onAssetHover(assetIndex)}
                  onMouseLeave={() => onAssetHover(null)}
                >
                  {/* Pin */}
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all",
                      isFullscreen ? "w-10 h-10" : "w-8 h-8",
                      isVisible ? "scale-100" : "scale-75 opacity-50",
                      isHovered && "scale-110 ring-2 ring-white/60"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    <MapPin className={cn("text-white", isFullscreen ? "h-5 w-5" : "h-4 w-4")} />
                  </div>
                  {/* Tooltip on hover */}
                  <div
                    className={cn(
                      "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 transition-opacity pointer-events-none z-20",
                      isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <div
                      className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 whitespace-nowrap"
                      style={{ fontFamily: "'Plus Jakarta Sans', var(--font-sans), sans-serif" }}
                    >
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
            "absolute z-10 p-2 rounded-lg border shadow-md transition-all",
            isFullscreen ? "bottom-5 left-5" : "bottom-3 left-3",
            showBoundaries
              ? "bg-primary/90 border-primary text-primary-foreground"
              : "bg-background/80 backdrop-blur-sm border-border/60 text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setShowBoundaries((p) => !p)}
          title={showBoundaries ? "Hide boundaries" : "Show LAD boundaries"}
        >
          <Layers className={cn(isFullscreen ? "h-4 w-4" : "h-3.5 w-3.5")} />
        </button>
      )}
    </>
  )

  // ===========================================================================
  // Fullscreen overlay (portaled to body)
  // ===========================================================================
  if (isFullscreen) {
    return (
      <>
        {/* Placeholder so the grid layout doesn't collapse */}
        <div className="relative h-full w-full rounded-2xl overflow-hidden border border-border/40 bg-muted/20 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Map expanded</p>
        </div>

        {createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-background"
            style={{ fontFamily: "'Plus Jakarta Sans', var(--font-sans), sans-serif" }}
          >
            {/* ============================================================= */}
            {/* Top toolbar — mirrors map-scaffold.tsx FullscreenToolbar        */}
            {/* Logo (left) · Year slider (center) · Close (right)            */}
            {/* ============================================================= */}
            <div className="absolute top-0 left-0 right-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
              <div className="w-full px-6 py-4 flex items-center justify-between">
                {/* Left cluster: Logo + owner + title */}
                <div className="flex items-center gap-4 min-w-0 flex-shrink-0">
                  <div className="relative h-16 w-16 flex-shrink-0">
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
                  <div className="h-6 w-px bg-border/50" />
                  {ownerFilter && (
                    <CompanyLogo
                      name={ownerFilter}
                      size={28}
                      showFallback={true}
                      className="rounded-lg ring-1 ring-border/20"
                    />
                  )}
                  <div>
                    <h2 className="text-sm font-semibold text-foreground tracking-tight leading-tight">
                      Portfolio Map
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {assets.length} location{assets.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Center cluster: Year slider */}
                <div className="flex-1 px-12">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Year</span>
                    </div>
                    <Slider
                      value={[choroplethYear]}
                      onValueChange={(value) => setChoroplethYear(value[0])}
                      min={YEARS.min}
                      max={YEARS.max}
                      step={1}
                      className="w-full"
                    />
                    {/* Dynamic year label that follows the thumb */}
                    <div className="relative h-4">
                      <div
                        className="absolute transform -translate-x-1/2 text-sm font-medium pointer-events-none"
                        style={{
                          left: `${((choroplethYear - YEARS.min) / (YEARS.max - YEARS.min)) * 100}%`,
                          transition: "none",
                        }}
                      >
                        {choroplethYear}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{YEARS.min}</span>
                      <span>{YEARS.max}</span>
                    </div>
                  </div>
                </div>

                {/* Right cluster: Back + Close */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                </div>
              </div>
            </div>

            {/* Map fills the viewport (pt-[100px] accounts for taller toolbar with slider) */}
            <div className="absolute inset-0 pt-[100px]">
              <div className="relative w-full h-full">
                {mapContent}
              </div>
            </div>

            {/* ============================================================= */}
            {/* Right-side floating panel — mirrors map-scaffold.tsx           */}
            {/* FullscreenControls pattern: indicators + controls stacked      */}
            {/* ============================================================= */}
            <div className="absolute top-[116px] right-4 z-20 w-[320px] flex flex-col gap-3 max-h-[calc(100vh-132px)]">
              {/* Indicator selector */}
              <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg p-3">
                <h4 className="text-xs font-semibold mb-2 text-foreground/90">Indicators</h4>
                <div className="space-y-0.5">
                  {METRICS.map((metric) => (
                    <button
                      key={metric.id}
                      onClick={() => setSelectedMetric(metric.id)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2",
                        selectedMetric === metric.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        selectedMetric === metric.id ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Choropleth toggle */}
              <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg p-3">
                <h4 className="text-xs font-semibold mb-2 text-foreground/90">Map Display</h4>
                <div className="flex rounded-lg border border-border/40 p-0.5 bg-muted/30">
                  <button
                    onClick={() => setShowChoropleth(true)}
                    className={cn(
                      "flex-1 text-xs py-1.5 rounded-md font-medium transition-all",
                      showChoropleth
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Choropleth
                  </button>
                  <button
                    onClick={() => setShowChoropleth(false)}
                    className={cn(
                      "flex-1 text-xs py-1.5 rounded-md font-medium transition-all",
                      !showChoropleth
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Boundaries
                  </button>
                </div>
              </div>

              {/* Asset list */}
              <div className="bg-background/90 backdrop-blur-md rounded-lg border border-border/50 shadow-lg overflow-hidden flex-1 min-h-0 overflow-y-auto">
                <div className="divide-y divide-border/30">
                  {assets.map((asset, i) => {
                    const color = ASSET_COLORS[i % ASSET_COLORS.length]
                    const Icon = getAssetClassIcon(asset.asset_class)
                    const isHovered = hoveredAssetIndex === i
                    const archetype = signalsMap[asset.region_code]?.archetype

                    return (
                      <Link
                        key={asset.id}
                        href={`/gp/${asset.slug}`}
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-3 transition-colors group",
                          isHovered ? "bg-muted/40" : "hover:bg-muted/20"
                        )}
                        onMouseEnter={() => onAssetHover(i)}
                        onMouseLeave={() => onAssetHover(null)}
                      >
                        {/* Color dot */}
                        <span
                          className={cn(
                            "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform",
                            isHovered && "scale-125"
                          )}
                          style={{ backgroundColor: color }}
                        />

                        {/* Icon */}
                        <div
                          className="p-1.5 rounded-lg flex-shrink-0"
                          style={{ backgroundColor: `${color}08` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color }} />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate leading-tight">
                            {asset.address}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground truncate">
                              {asset.region_name}
                            </span>
                            {asset.asset_class && (
                              <span className="text-[10px] text-muted-foreground/50">
                                · {asset.asset_class}
                              </span>
                            )}
                            {archetype && (
                              <span className="text-[10px] text-muted-foreground/50">
                                · {archetype}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  // ===========================================================================
  // Normal (inline) view
  // ===========================================================================
  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden border border-border/40">
      {mapContent}

      {/* Fullscreen toggle */}
      {!mapLoading && geocodedAssets.length > 0 && (
        <button
          className="absolute top-3 left-3 z-10 p-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/60 shadow-md text-muted-foreground hover:text-foreground hover:scale-110 transition-all"
          onClick={() => setIsFullscreen(true)}
          title="Expand map"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
