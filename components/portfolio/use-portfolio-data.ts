"use client"

/**
 * Shared data hook for portfolio v2.
 * Handles series fetching, signal loading, geocoding, and all derived chart data.
 * Single source of truth consumed by all portfolio sub-components.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries } from "@/lib/data-service"
import type {
  PortfolioAssetItem,
  AssetSeriesData,
  RegionSignals,
  SignalData,
  GeocodedAsset,
  MetricConfig,
} from "./portfolio-types"
import { METRICS, ASSET_COLORS } from "./portfolio-types"

// =============================================================================
// Internal helpers
// =============================================================================

function resolveUiRegionCode(dbCode: string): string {
  const match = REGIONS.find((r) => r.dbCode === dbCode)
  return match?.code ?? dbCode
}

// =============================================================================
// Hook
// =============================================================================

export interface UsePortfolioDataReturn {
  // State
  selectedMetric: string
  setSelectedMetric: (id: string) => void
  selectedMetricConfig: MetricConfig
  scenario: Scenario
  visible: boolean[]
  toggleAsset: (index: number) => void
  hoveredAssetIndex: number | null
  setHoveredAssetIndex: (index: number | null) => void

  // Data
  seriesMap: Record<string, AssetSeriesData>
  signalsMap: Record<string, RegionSignals>
  geocodedAssets: GeocodedAsset[]
  isLoading: boolean
  signalsLoading: boolean
  mapLoading: boolean

  // Derived
  visibleAssets: PortfolioAssetItem[]
  baseYear: number
  forecastStartYear: number
  baseValues: Record<number, number>
  chartData: Record<string, any>[]
  yDomain: [number, number]
  barData: { name: string; value: number; color: string }[]

  // Map helpers
  mapRef: React.MutableRefObject<any>
  fitMapBounds: (map: any, points: GeocodedAsset[]) => void
  getGeoForAsset: (assetId: string) => GeocodedAsset | undefined

  // KPI derived data
  metricValueForAsset: (assetIndex: number) => number | null
}

export function usePortfolioData(assets: PortfolioAssetItem[]) {
  const year = new Date().getFullYear()

  // ---- Core state ----
  const [selectedMetric, setSelectedMetric] = useState(METRICS[0].id)
  const [scenario] = useState<Scenario>("baseline")
  const [visible, setVisible] = useState<boolean[]>(() => assets.map(() => true))

  // Keep visible array in sync when assets change (e.g. after adding a new site)
  useEffect(() => {
    setVisible((prev) => {
      if (prev.length === assets.length) return prev
      return assets.map((_, i) => prev[i] ?? true)
    })
  }, [assets])

  const [seriesMap, setSeriesMap] = useState<Record<string, AssetSeriesData>>({})
  const [signalsMap, setSignalsMap] = useState<Record<string, RegionSignals>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [signalsLoading, setSignalsLoading] = useState(true)
  const [geocodedAssets, setGeocodedAssets] = useState<GeocodedAsset[]>([])
  const [mapLoading, setMapLoading] = useState(true)
  const [hoveredAssetIndex, setHoveredAssetIndex] = useState<number | null>(null)
  const mapRef = useRef<any>(null)

  const selectedMetricConfig = METRICS.find((m) => m.id === selectedMetric)!

  // ---- Derived: unique region codes ----
  const uniqueRegions = useMemo(() => {
    const map = new Map<string, string>()
    assets.forEach((a) => {
      if (!map.has(a.region_code)) {
        map.set(a.region_code, resolveUiRegionCode(a.region_code))
      }
    })
    return map
  }, [assets])

  // ---- Visible assets ----
  const visibleAssets = useMemo(
    () => assets.filter((_, i) => visible[i]),
    [assets, visible]
  )

  // ---- Toggle ----
  const toggleAsset = useCallback((index: number) => {
    setVisible((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }, [])

  // =========================================================================
  // Geocoding
  // =========================================================================

  const fitMapBounds = useCallback((map: any, points: GeocodedAsset[]) => {
    if (!points.length || !map) return
    try {
      const lngs = points.map((p) => p.lng)
      const lats = points.map((p) => p.lat)
      const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)]
      const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)]
      map.fitBounds([sw, ne], { padding: 60, maxZoom: 12, duration: 800 })
    } catch {
      /* ignore */
    }
  }, [])

  const getGeoForAsset = useCallback(
    (assetId: string) => geocodedAssets.find((g) => g.assetId === assetId),
    [geocodedAssets]
  )

  useEffect(() => {
    let cancelled = false
    async function geocodeAll() {
      setMapLoading(true)
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) {
        setMapLoading(false)
        return
      }

      const results: GeocodedAsset[] = []
      await Promise.all(
        assets.map(async (asset) => {
          const searchQuery = asset.postcode
            ? `${asset.postcode}, United Kingdom`
            : `${asset.address}, United Kingdom`
          const query = encodeURIComponent(searchQuery)
          const types = asset.postcode ? "postcode,address" : "address,place,poi"
          try {
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=GB&types=${types}&limit=1`
            )
            if (!res.ok) return
            const data = await res.json()
            if (data.features?.length) {
              const [lng, lat] = data.features[0].center
              results.push({ assetId: asset.id, lat, lng })
            }
          } catch {
            /* skip */
          }
        })
      )
      if (!cancelled) {
        setGeocodedAssets(results)
        setMapLoading(false)
        if (results.length > 0 && mapRef.current) {
          fitMapBounds(mapRef.current, results)
        }
      }
    }
    geocodeAll()
    return () => {
      cancelled = true
    }
  }, [assets, fitMapBounds])

  // =========================================================================
  // Series fetching
  // =========================================================================

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const results: Record<string, AssetSeriesData> = {}
      const entries = Array.from(uniqueRegions.entries())
      await Promise.all(
        entries.map(async ([dbCode, uiCode]) => {
          try {
            const raw = await fetchSeries({
              metricId: selectedMetric,
              region: uiCode,
              scenario,
            })
            const processed = raw
              .filter((d) => d.year >= year - 10 && d.year <= year + 10)
              .sort((a, b) => a.year - b.year)
              .map((d) => ({ year: d.year, value: d.value, type: d.type }))
            results[dbCode] = { regionCode: uiCode, data: processed }
          } catch {
            /* skip */
          }
        })
      )
      if (!cancelled) {
        setSeriesMap(results)
        setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedMetric, scenario, uniqueRegions, year])

  // =========================================================================
  // Signals fetching
  // =========================================================================

  useEffect(() => {
    let cancelled = false
    async function loadSignals() {
      setSignalsLoading(true)
      const results: Record<string, RegionSignals> = {}
      const entries = Array.from(uniqueRegions.entries())
      await Promise.all(
        entries.map(async ([dbCode, uiCode]) => {
          try {
            const res = await fetch("/api/region-insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ regionCode: uiCode, year, scenario }),
            })
            if (res.ok) {
              const data = await res.json()
              const signals: Record<string, SignalData> = {}
              if (data?.ui?.signals) {
                for (const s of data.ui.signals) {
                  signals[s.id] = {
                    outcome: s.outcome,
                    strength: s.strength,
                    detail: s.detail,
                  }
                }
              }
              results[dbCode] = {
                archetype: data?.ui?.bucketLabel ?? null,
                signals,
              }
            }
          } catch {
            /* skip */
          }
        })
      )
      if (!cancelled) {
        setSignalsMap(results)
        setSignalsLoading(false)
      }
    }
    loadSignals()
    return () => {
      cancelled = true
    }
  }, [uniqueRegions, year, scenario])

  // =========================================================================
  // Chart data derivations
  // =========================================================================

  const baseYear = useMemo(() => {
    let maxHist = 2024
    visibleAssets.forEach((a) => {
      const series = seriesMap[a.region_code]
      if (!series) return
      series.data.forEach((d) => {
        if (
          (d.type === "historical" || (d.type == null && d.year < 2025)) &&
          d.year > maxHist
        ) {
          maxHist = d.year
        }
      })
    })
    return maxHist
  }, [visibleAssets, seriesMap])

  const forecastStartYear = baseYear

  const baseValues = useMemo(() => {
    const bases: Record<number, number> = {}
    assets.forEach((a, i) => {
      const series = seriesMap[a.region_code]
      if (!series) return
      const pt = series.data.find((d) => d.year === baseYear)
      if (pt) bases[i] = pt.value
    })
    return bases
  }, [assets, seriesMap, baseYear])

  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, any>>()
    visibleAssets.forEach((a) => {
      const globalIdx = assets.indexOf(a)
      const series = seriesMap[a.region_code]
      if (!series) return
      const base = baseValues[globalIdx]
      if (!base) return
      series.data.forEach((pt) => {
        if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
        const row = yearMap.get(pt.year)!
        const indexed = (pt.value / base) * 100
        const isForecast = pt.type === "forecast" || pt.year >= forecastStartYear
        if (isForecast) {
          row[`a${globalIdx}_fcst`] = indexed
          if (pt.year === forecastStartYear) row[`a${globalIdx}_hist`] = indexed
        } else {
          row[`a${globalIdx}_hist`] = indexed
        }
      })
    })
    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [assets, visibleAssets, seriesMap, baseValues, forecastStartYear])

  const yDomain = useMemo((): [number, number] => {
    const allValues: number[] = []
    chartData.forEach((row) => {
      Object.entries(row).forEach(([key, val]) => {
        if (key !== "year" && val != null) allValues.push(val as number)
      })
    })
    if (allValues.length === 0) return [95, 105]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.08
    return [
      Math.floor((min - padding) / 2) * 2,
      Math.ceil((max + padding) / 2) * 2,
    ]
  }, [chartData])

  const barData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = []
    visibleAssets.forEach((a) => {
      const globalIdx = assets.indexOf(a)
      const series = seriesMap[a.region_code]
      if (!series) return
      const pt = series.data.find((d) => d.year === baseYear)
      if (pt) {
        data.push({
          name: a.region_name,
          value: pt.value,
          color: ASSET_COLORS[globalIdx % ASSET_COLORS.length],
        })
      }
    })
    return data.sort((a, b) => b.value - a.value)
  }, [assets, visibleAssets, seriesMap, baseYear])

  // =========================================================================
  // Per-asset metric value (for cards)
  // =========================================================================

  const metricValueForAsset = useCallback(
    (assetIndex: number) => {
      const asset = assets[assetIndex]
      if (!asset) return null
      const series = seriesMap[asset.region_code]
      if (!series) return null
      const pt = series.data.find((d) => d.year === baseYear)
      return pt?.value ?? null
    },
    [assets, seriesMap, baseYear]
  )

  // =========================================================================
  // Return
  // =========================================================================

  return {
    selectedMetric,
    setSelectedMetric,
    selectedMetricConfig,
    scenario,
    visible,
    toggleAsset,
    hoveredAssetIndex,
    setHoveredAssetIndex,
    seriesMap,
    signalsMap,
    geocodedAssets,
    isLoading,
    signalsLoading,
    mapLoading,
    visibleAssets,
    baseYear,
    forecastStartYear,
    baseValues,
    chartData,
    yDomain,
    barData,
    mapRef,
    fitMapBounds,
    getGeoForAsset,
    metricValueForAsset,
  }
}
