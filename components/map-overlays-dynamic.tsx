"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Source, Layer, useMap } from "@vis.gl/react-mapbox"
import { createClient } from "@supabase/supabase-js"
import bbox from "@turf/bbox"
import { formatValue } from "@/lib/data-service"
import { METRICS } from "@/lib/metrics.config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { SOURCE_ID } from "@/lib/map/region-layers"
import { getCacheKey, getCached, getOrFetch } from "@/lib/cache/choropleth-cache"
import type { ChoroplethStats } from "@/lib/map/choropleth-stats"
import {
  buildMapboxColorRamp,
  getGrowthMapType,
  getMapColorForValue,
  type MapType,
  DIVERGING_GROWTH_METRICS,
} from "@/lib/map-color-scale"

// Supabase client (env must be set)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

import type { RegionMetadata, RegionLevel } from "@/components/region-search"
type MapMode = "value" | "growth"

type OutlineSpec = { level: RegionLevel; code: string }

/** Calculate CAGR (Compound Annual Growth Rate) */
function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years === 0) return 0
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
}

interface MapOverlaysDynamicProps {
  show: boolean
  metric: string
  year: number
  scenario: string
  level?: RegionLevel
  mapMode?: MapMode
  growthPeriod?: number // Growth period in years (1=YoY, 2, 3, 5, 10, etc.)
  selectedRegion?: RegionMetadata | null
  /** Optional: fit the viewport to this region bbox (used for parent catchment views). */
  focusRegion?: RegionMetadata | null
  /** Optional: fade features not included in this code set (codes must match the active `level`'s geojson code property). */
  maskRegionCodes?: string[]
  /** Optional: draw an outline for a parent region boundary (e.g. ITL1 outline when viewing LADs). */
  parentOutline?: OutlineSpec | null
  hoverInfo?: {
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
    growthRate?: number | null // Growth rate for growth mode (YoY % or CAGR)
  } | null
  onChoroplethStats?: (stats: ChoroplethStats | null) => void
  mapId: string
}

// GeoJSON file paths - Cloudflare R2 CDN (with fallback to local for development)
const getGeoJsonPath = (level: RegionLevel): string => {
  // Use CDN in production, local files in development (or if CDN fails)
  const useCDN = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_CDN !== 'false'
  
  if (useCDN) {
    return `https://pub-aad6b4b085f8487dbfe1151db5bb3751.r2.dev/boundaries/${level}.geojson`
  }
  
  // Fallback to local files
  return `/boundaries/${level}.geojson`
}

const GEO_PATHS: Record<RegionLevel, string> = {
  UK: getGeoJsonPath('UK'),
  ITL1: getGeoJsonPath('ITL1'),
  ITL2: getGeoJsonPath('ITL2'),
  ITL3: getGeoJsonPath('ITL3'),
  LAD: getGeoJsonPath('LAD'),
}

// Property name mapping for each level
const PROPERTY_MAP: Record<RegionLevel, { code: string; name: string }> = {
  UK: { code: "shapeISO", name: "shapeName" }, // UK GeoJSON uses these properties
  ITL1: { code: "ITL125CD", name: "ITL125NM" },
  ITL2: { code: "ITL225CD", name: "ITL225NM" }, // Updated to 2025 codes
  ITL3: { code: "ITL325CD", name: "ITL325NM" },
  LAD: { code: "LAD24CD", name: "LAD24NM" },
}

// ONS region_code -> ITL125CD (TL*) - only for ITL1
const REGION_TO_TL: Record<string, string> = {
  // England
  E12000001: "TLC", // NE
  E12000002: "TLD", // NW
  E12000003: "TLE", // Y&H
  E12000004: "TLF", // EMids
  E12000005: "TLG", // WMids
  E12000006: "TLH", // East
  E12000007: "TLI", // London
  E12000008: "TLJ", // SE
  E12000009: "TLK", // SW
  // Devolved nations
  W92000004: "TLL", // Wales
  S92000003: "TLM", // Scotland
  N92000002: "TLN", // NI
}

// ITL125CD (TL*) -> UK slug
const TL_TO_UK: Record<string, string> = {
  TLC: "UKC", // North East
  TLD: "UKD", // North West
  TLE: "UKE", // Yorkshire & Humber
  TLF: "UKF", // East Midlands
  TLG: "UKG", // West Midlands
  TLH: "UKH", // East of England
  TLI: "UKI", // London
  TLJ: "UKJ", // South East
  TLK: "UKK", // South West
  TLL: "UKL", // Wales
  TLM: "UKM", // Scotland
  TLN: "UKN", // Northern Ireland
}

// UK slug -> ITL125CD (TL*)
const UK_TO_TL: Record<string, string> = Object.entries(TL_TO_UK).reduce(
  (acc, [tl, uk]) => {
    acc[uk] = tl
    return acc
  },
  {} as Record<string, string>
)

// ITL2 now uses 2025 boundaries (matching database codes directly)
// No mapping needed - codes match 1:1

// ITL3 old GeoJSON codes -> new database codes mapping
// Some ITL3 regions had code changes between versions
const ITL3_OLD_TO_NEW: Record<string, string> = {
  "TLE32": "TLE36", // Sheffield (old code in GeoJSON -> new code in database)
  // Add more mappings as needed when other regions are found to be grey
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }

/**
 * Determine map type based on mode and metric characteristics
 * 
 * Map types (semantic):
 * - "level": Sequential blue scale for absolute values (Type A)
 * - "growth": Diverging scale for growth/change (Type B) - only for metrics that can decline
 * 
 * Note: Always-positive growth metrics (GVA, GDHI) use "level" type (sequential blue)
 * since they never have negative values, so diverging scale isn't needed.
 */
function getMapType(mapMode: MapMode, metricId: string): MapType {
  if (mapMode === "value") {
    return "level" // Absolute values → sequential blue
  }

  // Growth mode: centralized semantics (diverging orange→neutral→blue by default)
  return getGrowthMapType(metricId)
}

function quantile(sorted: number[], p: number) {
  if (sorted.length === 0) return NaN
  const pp = Math.min(1, Math.max(0, p))
  const idx = (sorted.length - 1) * pp
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const w = idx - lo
  return sorted[lo] * (1 - w) + sorted[hi] * w
}

export function MapOverlaysDynamic({
  show,
  metric,
  year,
  scenario,
  level = "ITL1",
  mapMode = "value",
  growthPeriod = 5,
  selectedRegion,
  focusRegion,
  maskRegionCodes,
  parentOutline,
  hoverInfo,
  onChoroplethStats,
  mapId,
}: MapOverlaysDynamicProps) {
  const router = useRouter()
  // Important: do NOT gate rendering of <Source>/<Layer> on a potentially-undefined map lookup.
  // During style/layout churn, react-mapbox's registry can be temporarily empty for a given id,
  // and toggling <Source> mount/unmount can cause Mapbox to throw during removeSource().
  // We only use the Mapbox map for imperative camera actions (fitBounds).
  const maps = (useMap as any)()
  const mapRef = maps?.[mapId] ?? maps?.default ?? maps?.current
  const mapbox = mapRef?.getMap?.() ?? mapRef
  const didFitRef = useRef<Record<RegionLevel, boolean>>({
    ITL1: false,
    ITL2: false,
    ITL3: false,
    LAD: false,
  })
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REGION "POP" ANIMATION - pulse effect when selecting a region
  // ─────────────────────────────────────────────────────────────────────────────
  const [selectionPulse, setSelectionPulse] = useState(false)
  const lastSelectedCodeRef = useRef<string | null>(null)
  
  // Trigger pulse animation when selected region changes
  useEffect(() => {
    if (selectedRegion?.code && selectedRegion.code !== lastSelectedCodeRef.current) {
      lastSelectedCodeRef.current = selectedRegion.code
      setSelectionPulse(true)
      
      // Reset pulse after animation completes
      const timer = setTimeout(() => setSelectionPulse(false), 600)
      return () => clearTimeout(timer)
    }
  }, [selectedRegion?.code])

  const lastFocusKeyRef = useRef<string | null>(null)

  const maskSet = useMemo(() => {
    if (!maskRegionCodes || maskRegionCodes.length === 0) return null
    return new Set(maskRegionCodes)
  }, [maskRegionCodes])

  const [parentGeoData, setParentGeoData] = useState<GeoJSON.FeatureCollection | null>(null)

  const [metricRows, setMetricRows] = useState<Array<{ 
    region_code: string; 
    value: number | null;
    ci_lower?: number | null;
    ci_upper?: number | null;
    data_type?: string;
  }>>([])
  // Store past year data for growth rate calculation in growth mode
  const [metricRowsPast, setMetricRowsPast] = useState<Array<{ 
    region_code: string; 
    value: number | null;
  }>>([])
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)
  const geoDataLevelRef = useRef<RegionLevel | null>(null)
  // Cache GeoJSON per level (prevents refetch + prevents “wrong-level geoData” being processed).
  const geoCacheRef = useRef<Partial<Record<RegionLevel, GeoJSON.FeatureCollection>>>({})
  // Request guard to prevent out-of-order fetches from overwriting the current level’s geoData.
  const geoReqIdRef = useRef(0)
  // Keep last-good enriched data per level to avoid tearing down <Source> during fetch churn.
  // This reduces the “renders fine but dead interactivity” class of bugs caused by source removal/re-add.
  const enrichedCacheRef = useRef<Partial<Record<RegionLevel, GeoJSON.FeatureCollection>>>({})
  
  // Get metric info for formatting
  const metricInfo = useMemo(() => {
    return METRICS.find(m => m.id === metric)
  }, [metric])

  // Determine table name based on level
  const tableName = level === "UK" ? "macro_latest_all" :
                    level === "ITL1" ? "itl1_latest_all" :
                    level === "ITL2" ? "itl2_latest_all" :
                    level === "ITL3" ? "itl3_latest_all" :
                    level === "LAD" ? "lad_latest_all" :
                    "itl1_latest_all"

  // Get the correct metric_id for the table (macro_latest_all uses uk_ prefix)
  const queryMetricId = level === "UK" ? `uk_${metric}` : metric

  // Load GeoJSON for the active level.
  // IMPORTANT: Must be race-safe. Rapid level switching can otherwise apply ITL1/ITL3/LAD geoData
  // while `level === ITL2`, producing `codeValue: undefined` and breaking choropleth + interactivity.
  useEffect(() => {
    const cached = geoCacheRef.current[level]
    if (cached) {
      geoDataLevelRef.current = level
      setGeoData(cached)
      return
    }

    const reqId = ++geoReqIdRef.current
    const ac = new AbortController()
    // Clear geoData immediately to avoid enriching the previous level’s shapes under the new `level`.
    geoDataLevelRef.current = null
    setGeoData(null)

    ;(async () => {
      try {
        const url = GEO_PATHS[level]
        const response = await fetch(url, { signal: ac.signal })
        
        if (!response.ok) {
          throw new Error(`Failed to load ${level} GeoJSON: ${response.status} ${response.statusText}`)
        }
        
        const data = (await response.json()) as GeoJSON.FeatureCollection
        if (geoReqIdRef.current !== reqId) return
        geoCacheRef.current[level] = data
        geoDataLevelRef.current = level
        setGeoData(data)
      } catch (error: any) {
        if (error?.name === "AbortError") return
        console.error(`Error loading ${level} GeoJSON from ${GEO_PATHS[level]}:`, error)
        
        // If CDN fails, try local fallback
        if (GEO_PATHS[level].startsWith("http")) {
          console.log(`Attempting fallback to local file for ${level}...`)
          try {
            const localUrl = `/boundaries/${level}.geojson`
            const fallbackResponse = await fetch(localUrl, { signal: ac.signal })
            if (!fallbackResponse.ok) throw new Error(`Fallback failed: ${fallbackResponse.status}`)
            const data = (await fallbackResponse.json()) as GeoJSON.FeatureCollection
            if (geoReqIdRef.current !== reqId) return
            geoCacheRef.current[level] = data
            geoDataLevelRef.current = level
            setGeoData(data)
              console.log(`Successfully loaded ${level} from local fallback`)
          } catch (fallbackError: any) {
            if (fallbackError?.name === "AbortError") return
            console.error(`Fallback also failed for ${level}:`, fallbackError)
            if (geoReqIdRef.current === reqId) {
              geoDataLevelRef.current = null
              setGeoData(null)
            }
          }
        } else {
          if (geoReqIdRef.current === reqId) {
            geoDataLevelRef.current = null
          setGeoData(null)
          }
        }
      }
    })()

    return () => {
      ac.abort()
    }
  }, [level])

  // 1) Fetch Supabase slice with scenario-aware value selection
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const key = getCacheKey([level, metric, year, scenario])
      const cached = getCached<typeof metricRows>(key)
      if (cached) {
        setMetricRows(cached)
        return
      }

      console.log(`🗺️ [Choropleth] Fetching data for ${level}:`, { metric, queryMetricId, year, scenario, tableName })
      console.log(`🔍 [Choropleth] Query: metric_id="${queryMetricId}", period=${year}, table="${tableName}"`)
        
      try {
        const processedRows = await getOrFetch<typeof metricRows>(key, async () => {
        // NI jobs uses a different metric_id (`emp_total_jobs_ni`) and ITL1 NI jobs live in ITL2 (TLN0).
        // For "jobs" maps, we merge emp_total_jobs + emp_total_jobs_ni so NI doesn't appear blank.
        let data: any[] | null = null

        if (metric === "emp_total_jobs") {
          const { data: baseRows, error: baseErr } = await supabase
        .from(tableName)
        .select("region_code, value, ci_lower, ci_upper, data_type")
            .eq("metric_id", queryMetricId)
        .eq("period", year)
          if (baseErr) throw new Error(baseErr.message)

          if (level === "ITL1") {
            // Patch NI from TLN0 into N92000002 (so REGION_TO_TL maps it to UKN).
            const { data: niRows, error: niErr } = await supabase
              .from("itl2_latest_all")
              .select("region_code, value, ci_lower, ci_upper, data_type")
              .eq("metric_id", "emp_total_jobs_ni")
              .eq("period", year)
              .eq("region_code", "TLN0")
              .limit(1)
            if (niErr) throw new Error(niErr.message)

            const patched = (niRows ?? []).map((r) => ({ ...r, region_code: "N92000002" }))
            data = [...(baseRows ?? []), ...patched]
          } else {
            const { data: niRows, error: niErr } = await supabase
              .from(tableName)
              .select("region_code, value, ci_lower, ci_upper, data_type")
              .eq("metric_id", "emp_total_jobs_ni")
              .eq("period", year)
            if (niErr) throw new Error(niErr.message)
            data = [...(baseRows ?? []), ...(niRows ?? [])]
          }
        } else {
          const { data: rows, error } = await supabase
            .from(tableName)
            .select("region_code, value, ci_lower, ci_upper, data_type")
            .eq("metric_id", queryMetricId)
            .eq("period", year)
        if (error) {
            throw new Error(error.message)
          }
          data = rows ?? []
          }
          
          // Process rows to select correct value based on scenario
          return (data ?? []).map((row) => {
            let selectedValue: number | null = null
            
            // For historical data, always use value
            if (row.data_type === "historical") {
              selectedValue = row.value ?? null
            } else {
              // For forecast data, select based on scenario
              switch (scenario) {
                case "baseline":
                  selectedValue = row.value ?? null
                  break
                case "downside":
                  selectedValue = row.ci_lower ?? row.value ?? null
                  break
                case "upside":
                  selectedValue = row.ci_upper ?? row.value ?? null
                  break
                default:
                  selectedValue = row.value ?? null
              }
            }
            
            return {
              region_code: row.region_code,
              value: selectedValue,
              ci_lower: row.ci_lower,
              ci_upper: row.ci_upper,
              data_type: row.data_type,
            }
          })
        })

        if (cancelled) return
        console.log(`✅ [Choropleth] Rows: ${processedRows.length} (cache key: ${key})`)
          setMetricRows(processedRows)
      } catch (err: any) {
        if (cancelled) return
        console.error("❌ [Choropleth] Supabase fetch error:", err?.message ?? err)
        setMetricRows([])
      }
    })()
    return () => { cancelled = true }
  }, [metric, year, scenario, tableName, level])

  // 2) Fetch past year data (year - growthPeriod) for growth calculation in growth mode
  useEffect(() => {
    // Always fetch past data so it's ready when user switches to growth mode
    let cancelled = false
    const pastYear = year - growthPeriod
    ;(async () => {
      const key = getCacheKey([level, metric, pastYear, scenario, "past", growthPeriod])
      const cached = getCached<typeof metricRowsPast>(key)
      if (cached) {
        setMetricRowsPast(cached)
        return
      }

      console.log(`🗺️ [Choropleth] Fetching past data for ${level}:`, { metric, year: pastYear, period: growthPeriod, scenario, tableName })
        
      try {
        const processedRows = await getOrFetch<typeof metricRowsPast>(key, async () => {
          let data: any[] | null = null

          if (metric === "emp_total_jobs") {
            const { data: baseRows, error: baseErr } = await supabase
            .from(tableName)
            .select("region_code, value, ci_lower, ci_upper, data_type")
              .eq("metric_id", "emp_total_jobs")
            .eq("period", pastYear)
            if (baseErr) throw new Error(baseErr.message)

            if (level === "ITL1") {
              const { data: niRows, error: niErr } = await supabase
                .from("itl2_latest_all")
                .select("region_code, value, ci_lower, ci_upper, data_type")
                .eq("metric_id", "emp_total_jobs_ni")
                .eq("period", pastYear)
                .eq("region_code", "TLN0")
                .limit(1)
              if (niErr) throw new Error(niErr.message)

              const patched = (niRows ?? []).map((r) => ({ ...r, region_code: "N92000002" }))
              data = [...(baseRows ?? []), ...patched]
            } else {
              const { data: niRows, error: niErr } = await supabase
                .from(tableName)
                .select("region_code, value, ci_lower, ci_upper, data_type")
                .eq("metric_id", "emp_total_jobs_ni")
                .eq("period", pastYear)
              if (niErr) throw new Error(niErr.message)
              data = [...(baseRows ?? []), ...(niRows ?? [])]
            }
          } else {
            const { data: rows, error } = await supabase
              .from(tableName)
              .select("region_code, value, ci_lower, ci_upper, data_type")
              .eq("metric_id", metric)
              .eq("period", pastYear)
            if (error) throw new Error(error.message)
            data = rows ?? []
          }
          
          // Process rows to select correct value based on scenario
          return (data ?? []).map((row) => {
            let selectedValue: number | null = null
            
            if (row.data_type === "historical") {
              selectedValue = row.value ?? null
            } else {
              switch (scenario) {
                case "baseline":
                  selectedValue = row.value ?? null
                  break
                case "downside":
                  selectedValue = row.ci_lower ?? row.value ?? null
                  break
                case "upside":
                  selectedValue = row.ci_upper ?? row.value ?? null
                  break
                default:
                  selectedValue = row.value ?? null
              }
            }
            
            return {
              region_code: row.region_code,
              value: selectedValue,
            }
          })
        })

        if (cancelled) return
        console.log(`✅ [Choropleth] Past rows: ${processedRows.length} (cache key: ${key})`)
        setMetricRowsPast(processedRows)
      } catch (err: any) {
        if (cancelled) return
        console.error("❌ [Choropleth] Past data fetch error:", err?.message ?? err)
        setMetricRowsPast([])
      }
    })()
    return () => { cancelled = true }
  }, [metric, year, scenario, tableName, level, growthPeriod])

  // Warm GeoJSON caches in the background to make level switching instant after first load.
  const didPrefetchGeoRef = useRef(false)
  useEffect(() => {
    if (didPrefetchGeoRef.current) return
    didPrefetchGeoRef.current = true
    if (!show) return

    const levels: RegionLevel[] = ["ITL1", "ITL2", "ITL3", "LAD"]
    const run = async () => {
      for (const l of levels) {
        if (geoCacheRef.current[l]) continue
        try {
          const res = await fetch(GEO_PATHS[l])
          if (!res.ok) continue
          const data = (await res.json()) as GeoJSON.FeatureCollection
          geoCacheRef.current[l] = data
        } catch {
          // ignore
        }
      }
    }

    // Prefer idle time; fallback to a short delay.
    const ric = (globalThis as any).requestIdleCallback
    if (typeof ric === "function") {
      ric(() => run(), { timeout: 1500 })
    } else {
      setTimeout(() => run(), 250)
    }
  }, [show])

  // Load GeoJSON for parent outline (if requested). Uses the same cache as the main choropleth.
  useEffect(() => {
    if (!show) return
    if (!parentOutline) {
      setParentGeoData(null)
      return
    }

    const parentLevel = parentOutline.level
    const cached = geoCacheRef.current[parentLevel]
    if (cached) {
      setParentGeoData(cached)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(GEO_PATHS[parentLevel])
        if (!res.ok) throw new Error(`Failed to load ${parentLevel} GeoJSON`)
        const data = (await res.json()) as GeoJSON.FeatureCollection
        if (cancelled) return
        geoCacheRef.current[parentLevel] = data
        setParentGeoData(data)
      } catch {
        // best-effort fallback to local
        try {
          const localUrl = `/boundaries/${parentLevel}.geojson`
          const res = await fetch(localUrl)
          if (!res.ok) return
          const data = (await res.json()) as GeoJSON.FeatureCollection
          if (cancelled) return
          geoCacheRef.current[parentLevel] = data
          setParentGeoData(data)
        } catch {
          if (!cancelled) setParentGeoData(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [show, parentOutline])

  // 2a) Index past values by region code (for growth rate calculation)
  const pastValueIndex = useMemo(() => {
    const idx = new Map<string, number>()
    
    for (const row of metricRowsPast) {
      if (!row.region_code || row.value == null || !isFinite(row.value)) continue
      
      if (level === "ITL1") {
        const tl = REGION_TO_TL[row.region_code]
        if (tl) idx.set(tl, row.value)
      } else {
        idx.set(row.region_code, row.value)
      }
    }
    
    return idx
  }, [metricRowsPast, level])

  // 2b) Index current values OR growth rate values based on mapMode
  const valueIndex = useMemo(() => {
    const idx = new Map<string, number>()
    let matchedCount = 0
    let skippedCount = 0
    
    for (const row of metricRows) {
      if (!row.region_code || row.value == null || !isFinite(row.value)) {
        skippedCount++
        continue
      }
      
      // Resolve the key (TL code for ITL1, GBR for UK, region_code otherwise)
      let key: string | null = null
      if (level === "UK") {
        // UK GeoJSON uses shapeISO = "GBR", but Supabase uses K02000001
        if (row.region_code === "K02000001") key = "GBR"
      } else if (level === "ITL1") {
        const tl = REGION_TO_TL[row.region_code]
        if (tl) key = tl
      } else {
        key = row.region_code
      }
      
      if (!key) {
        skippedCount++
        continue
      }
      
      if (mapMode === "growth") {
        // In growth mode, calculate growth rate (YoY = simple %, longer = CAGR)
        const pastValue = pastValueIndex.get(key)
        if (pastValue != null && pastValue > 0 && row.value != null) {
          const growth = growthPeriod === 1
            ? ((row.value - pastValue) / pastValue) * 100
            : calculateCAGR(pastValue, row.value, growthPeriod)
          idx.set(key, growth)
          matchedCount++
        } else {
          skippedCount++
        }
      } else {
        // In value mode, use absolute value
        idx.set(key, row.value)
        matchedCount++
      }
    }
    
    console.log(`🔑 [Choropleth] ${mapMode === "growth" ? `Growth Rate (${growthPeriod === 1 ? "YoY" : `${growthPeriod}yr`})` : "Value"} index created: ${matchedCount} matched, ${skippedCount} skipped (total: ${metricRows.length})`)
    if (idx.size > 0) {
      const sampleCodes = Array.from(idx.keys()).slice(0, 5)
      const sampleValues = sampleCodes.map(c => ({ code: c, value: idx.get(c)?.toFixed(2) }))
      console.log(`🔑 [Choropleth] Sample indexed:`, sampleValues)
    }
    
    return idx
  }, [metricRows, level, mapMode, pastValueIndex])

  // 3) Outlier-robust scale for ramp (winsorize at p05–p95).
  // This prevents a single extreme region (e.g. City of London) from making everything else look flat.
  // For growth mode, use percentile-based scaling for always-positive metrics to show more variation.
  const { minVal, maxVal, clampMin, clampMax, percentiles } = useMemo(() => {
    const values = Array.from(valueIndex.values()).filter((v) => isFinite(v)).sort((a, b) => a - b)
    if (values.length === 0) {
      console.warn(`⚠️ [Choropleth] No valid values for color ramp`)
      return { minVal: NaN, maxVal: NaN, clampMin: NaN, clampMax: NaN, percentiles: null }
    }

    const rawMin = values[0]
    const rawMax = values[values.length - 1]
    
    if (mapMode === "growth") {
      // For growth mode with sequential ramps (if any), use percentile-based scaling.
      // If a metric is rendered as sequential in growth mode, values may cluster and look flat.
      const mapType = getMapType(mapMode, metric)
      const isAlwaysPositive = !DIVERGING_GROWTH_METRICS.has(metric)
      
      if (isAlwaysPositive && mapType === "level") {
        // AGGRESSIVE percentile-based scaling for maximum visual variation
        // Use wider range (p1-p99) and more granular percentiles for finer color gradation
        const p1 = quantile(values, 0.01)
        const p5 = quantile(values, 0.05)
        const p10 = quantile(values, 0.10)
        const p15 = quantile(values, 0.15)
        const p25 = quantile(values, 0.25)
        const p35 = quantile(values, 0.35)
        const p50 = quantile(values, 0.50)
        const p65 = quantile(values, 0.65)
        const p75 = quantile(values, 0.75)
        const p85 = quantile(values, 0.85)
        const p90 = quantile(values, 0.90)
        const p95 = quantile(values, 0.95)
        const p99 = quantile(values, 0.99)
        
        // Use very wide range (p1-p99) for maximum visual separation
        // This aggressively stretches the color scale to show differences
        const expandedMin = isFinite(p1) ? p1 : (isFinite(p5) ? p5 : rawMin)
        const expandedMax = isFinite(p99) ? p99 : (isFinite(p95) ? p95 : rawMax)
        
        console.log(
          `📈 [Choropleth] Growth range (always-positive, AGGRESSIVE): RAW=${rawMin.toFixed(2)}%–${rawMax.toFixed(2)}%, ` +
          `Expanded=${expandedMin.toFixed(2)}%–${expandedMax.toFixed(2)}%, ` +
          `Percentiles: p5=${p5.toFixed(2)}%, p15=${p15.toFixed(2)}%, p25=${p25.toFixed(2)}%, p35=${p35.toFixed(2)}%, p50=${p50.toFixed(2)}%, p65=${p65.toFixed(2)}%, p75=${p75.toFixed(2)}%, p85=${p85.toFixed(2)}%, p95=${p95.toFixed(2)}% (n=${values.length})`
        )
        
        return { 
          minVal: expandedMin, 
          maxVal: expandedMax, 
          clampMin: expandedMin, 
          clampMax: expandedMax,
          percentiles: { p5, p15, p25, p35, p50, p65, p75, p85, p95 }
        }
      } else {
        // For diverging growth metrics, use RAW min/max (no winsorization)
        console.log(
          `📈 [Choropleth] Growth range (diverging): RAW=${rawMin.toFixed(2)}%–${rawMax.toFixed(2)}% (n=${values.length}, no winsorization)`
        )
        
        return { minVal: rawMin, maxVal: rawMax, clampMin: rawMin, clampMax: rawMax, percentiles: null }
      }
    } else {
      // For value mode, use standard winsorization (p05–p95)
    const q05 = quantile(values, 0.05)
    const q95 = quantile(values, 0.95)

    const lo = isFinite(q05) ? q05 : rawMin
    const hi = isFinite(q95) ? q95 : rawMax
    const useLo = lo < hi ? lo : rawMin
    const useHi = lo < hi ? hi : rawMax

    console.log(
      `📈 [Choropleth] Value range raw=${rawMin.toLocaleString()}–${rawMax.toLocaleString()} winsor(p05–p95)=${useLo.toLocaleString()}–${useHi.toLocaleString()} (n=${values.length})`
    )

    return { minVal: useLo, maxVal: useHi, clampMin: useLo, clampMax: useHi, percentiles: null }
    }
  }, [valueIndex, mapMode, metric])

  // 4) Enrich features with values
  const enriched = useMemo(() => {
    // Guard: never enrich with mismatched level data.
    if (!geoData || geoDataLevelRef.current !== level) return null
    
    const propMap = PROPERTY_MAP[level]
    
    // Debug: Check property structure of first feature
    if (geoData.features.length > 0) {
      const firstFeature = geoData.features[0]
      const allProps = Object.keys(firstFeature.properties as any || {})
      console.log(`🔍 [Choropleth] GeoJSON property structure (first feature):`, {
        expectedCodeProperty: propMap.code,
        expectedNameProperty: propMap.name,
        allProperties: allProps,
        codeValue: (firstFeature.properties as any)?.[propMap.code],
        nameValue: (firstFeature.properties as any)?.[propMap.name]
      })
    }
    
    let matchedFeatures = 0
    let unmatchedFeatures = 0
    
    const features = geoData.features.map((f) => {
      let code = (f.properties as any)?.[propMap.code] as string | undefined
      
      // For ITL3, map old GeoJSON codes to new database codes
      if (level === "ITL3" && code && ITL3_OLD_TO_NEW[code]) {
        const newCode = ITL3_OLD_TO_NEW[code]
        console.log(`🔄 [Choropleth] Mapping ITL3 code ${code} -> ${newCode}`)
        code = newCode
      }
      
      const v = code ? valueIndex.get(code) ?? null : null
      
      // Mark selected region
      const isSelected = selectedRegion && code === selectedRegion.code
      const isInParent = maskSet ? (code ? maskSet.has(code) : false) : true
      
      if (v !== null) {
        matchedFeatures++
      } else if (code) {
        unmatchedFeatures++
      }
      
      return {
        ...f,
        properties: { 
          ...(f.properties as any), 
          value: v,
          __selected: isSelected || false,
          __inParent: isInParent,
        },
      } as GeoJSON.Feature
    })
    
    // Compare all GeoJSON codes with valueIndex keys
    const allGeoJsonCodes = features.map(f => (f.properties as any)?.[propMap.code]).filter(Boolean)
    const allValueIndexKeys = Array.from(valueIndex.keys())
    const missingFromGeoJson = allValueIndexKeys.filter(k => !allGeoJsonCodes.includes(k))
    const missingFromValueIndex = allGeoJsonCodes.filter(k => !allValueIndexKeys.includes(k))
    
    if (missingFromValueIndex.length > 0) {
      console.log(`⚠️ [Choropleth] Codes in GeoJSON but NOT in valueIndex (${missingFromValueIndex.length}):`, missingFromValueIndex.slice(0, 15))
    }
    if (missingFromGeoJson.length > 0) {
      console.log(`⚠️ [Choropleth] Codes in valueIndex but NOT in GeoJSON (${missingFromGeoJson.length}):`, missingFromGeoJson.slice(0, 15))
    }
    
    console.log(`🎨 [Choropleth] Enriched ${geoData.features.length} features: ${matchedFeatures} with values, ${unmatchedFeatures} without data`)
    
    // Check for specific problematic regions in GeoJSON
    const problemRegions = ['TLH5', 'TLK5', 'TLK6', 'TLL3', 'TLL4', 'TLL5', 'TLE56']
    const problemFeatures = features.filter(f => {
      const code = (f.properties as any)?.[propMap.code]
      return code && problemRegions.includes(code)
    })
    
    // Also check ALL features to see which ones don't have values
    const allUnmatchedFeatures = features.filter(f => {
      const code = (f.properties as any)?.[propMap.code]
      const value = (f.properties as any)?.value
      return code && value === null
    })
    
    if (problemFeatures.length > 0) {
      console.log(`🔍 [Choropleth] Problem regions in GeoJSON:`, problemFeatures.map(f => {
        const code = (f.properties as any)?.[propMap.code]
        const value = (f.properties as any)?.value
        const name = (f.properties as any)?.[propMap.name]
        const hasInValueIndex = code ? valueIndex.has(code) : false
        const valueFromIndex = code ? valueIndex.get(code) : undefined
        return { 
          code, 
          name, 
          value, 
          hasValue: value !== null,
          hasInValueIndex,
          valueFromIndex,
          codeType: typeof code,
          codeLength: code?.length
        }
      }))
    }
    
    // Show all unmatched features to identify the pattern
    if (allUnmatchedFeatures.length > 0) {
      console.log(`⚠️ [Choropleth] All unmatched features (${allUnmatchedFeatures.length}):`, 
        allUnmatchedFeatures.map(f => {
          const code = (f.properties as any)?.[propMap.code]
          const name = (f.properties as any)?.[propMap.name]
          const hasInValueIndex = code ? valueIndex.has(code) : false
          return { code, name, hasInValueIndex }
        }).slice(0, 15) // Show first 15
      )
    }
    
    if (unmatchedFeatures > 0) {
      // Show unmatched features for problem regions
      const unmatchedProblemFeatures = features.filter(f => {
        const code = (f.properties as any)?.[propMap.code]
        const value = (f.properties as any)?.value
        return code && problemRegions.includes(code) && value === null
      })
      
      if (unmatchedProblemFeatures.length > 0) {
        console.warn(`⚠️ [Choropleth] Unmatched problem regions:`, unmatchedProblemFeatures.map(f => {
          const code = (f.properties as any)?.[propMap.code]
          const name = (f.properties as any)?.[propMap.name]
          const inValueIndex = valueIndex.has(code)
          const similarKeys = Array.from(valueIndex.keys()).filter(k => {
            // Check for similar codes (same prefix, different suffix)
            const codePrefix = code?.slice(0, 3)
            const keyPrefix = k.slice(0, 3)
            return codePrefix === keyPrefix || code?.includes(k) || k.includes(code || '')
          })
          return { 
            code, 
            name, 
            inValueIndex, 
            expectedProperty: propMap.code,
            actualPropertyValue: code,
            similarKeysInIndex: similarKeys,
            allValueIndexKeys: Array.from(valueIndex.keys())
          }
        }))
      }
      
      if (matchedFeatures === 0) {
        console.warn(`⚠️ [Choropleth] No features matched! Sample GeoJSON codes:`, 
          features.slice(0, 10).map(f => (f.properties as any)?.[propMap.code]).filter(Boolean))
        console.warn(`⚠️ [Choropleth] Sample valueIndex codes:`, Array.from(valueIndex.keys()).slice(0, 10))
      }
    }
    
    // Inject stable IDs into features (using code as ID)
    const featuresWithIds = features.map((f) => {
      const code = (f.properties as any)?.[propMap.code] as string | undefined
      return {
        ...f,
        id: code, // Use code as stable, unique ID for Mapbox feature-state
      } as GeoJSON.Feature
    })
    
    return { ...geoData, features: featuresWithIds } as GeoJSON.FeatureCollection
  }, [geoData, valueIndex, level, selectedRegion, maskSet])

  // Rank/percentile stats (within current level) for “wow” tooltip comparisons.
  // Keys are raw GeoJSON codes (same codes Mapbox hit-testing returns).
  const choroplethStats = useMemo<ChoroplethStats | null>(() => {
    if (!enriched) return null
    const propMap = PROPERTY_MAP[level]
    const entries: Array<{ code: string; value: number }> = []

    for (const f of enriched.features) {
      const code = (f.properties as any)?.[propMap.code] as string | undefined
      const value = (f.properties as any)?.value as number | null | undefined
      if (!code) continue
      if (value == null || !isFinite(value)) continue
      entries.push({ code, value })
    }

    const total = enriched.features.length
    if (entries.length === 0) {
      return { level, n: 0, total, median: null, rankByCode: {}, valueByCode: {} }
    }

    const valueByCode: Record<string, number> = {}
    for (const e of entries) valueByCode[e.code] = e.value

    // Rank: 1 = highest value
    const desc = [...entries].sort((a, b) => b.value - a.value)
    const rankByCode: Record<string, number> = {}
    for (let i = 0; i < desc.length; i++) {
      rankByCode[desc[i].code] = i + 1
    }

    const ascValues = [...entries].map((e) => e.value).sort((a, b) => a - b)
    const median = isFinite(ascValues[0]) ? quantile(ascValues, 0.5) : null

    return { level, n: entries.length, total, median, rankByCode, valueByCode }
  }, [enriched, level])

  useEffect(() => {
    onChoroplethStats?.(choroplethStats)
  }, [choroplethStats, onChoroplethStats])

  // Update cache when we have a good enriched dataset.
  useEffect(() => {
    if (enriched && geoDataLevelRef.current === level) enrichedCacheRef.current[level] = enriched
  }, [enriched, level])

  // Reset fit bounds flag when level changes
  useEffect(() => {
    didFitRef.current[level] = false
  }, [level])

  // Track the last selected region to detect when switching between regions
  const lastSelectedRegionRef = useRef<string | null>(null)
  
  // 5) Auto-zoom to selected region (priority) or fit bounds to all regions (initial load only)
  useEffect(() => {
    if (!mapbox || !enriched) return
    
    // If selectedRegion is provided and matches current level, ALWAYS center and zoom to it
    if (selectedRegion && selectedRegion.level === level) {
      const regionBbox = selectedRegion.bbox
      
      // Validate bbox exists and is in WGS84 range
      if (regionBbox && Array.isArray(regionBbox) && regionBbox.length === 4 &&
          regionBbox[0] >= -180 && regionBbox[0] <= 180 && regionBbox[1] >= -90 && regionBbox[1] <= 90 &&
          regionBbox[2] >= -180 && regionBbox[2] <= 180 && regionBbox[3] >= -90 && regionBbox[3] <= 90) {
        
        // Check if this is a different region than the last one
        const isNewRegion = lastSelectedRegionRef.current !== selectedRegion.code
        const wasAlreadyFitted = didFitRef.current[level]
        lastSelectedRegionRef.current = selectedRegion.code
        
        // If switching between regions at the same level, use smooth transition
        // Otherwise, use standard fitBounds
        const isRegionSwitch = isNewRegion && wasAlreadyFitted
        
        // ALWAYS center and zoom to the selected region
        // fitBounds automatically centers the view on the bounding box
        // This ensures the map re-centers every time a new region is clicked
        mapbox.fitBounds(
          [[regionBbox[0], regionBbox[1]], [regionBbox[2], regionBbox[3]]],
          { 
            padding: 40, 
            duration: isRegionSwitch ? 600 : 800, // Faster transition when switching
            pitch: 0, 
            bearing: 0,
            maxZoom: 15, // Allow zooming in for detailed regions
            essential: true // Ensure this animation is not interrupted
          }
        )
        didFitRef.current[level] = true // Mark as fitted so we don't fit to all regions
        return
      } else {
        console.warn(`⚠️ [Map] Invalid bbox for region ${selectedRegion.code}:`, regionBbox)
      }
    }

    // If a focusRegion is provided (e.g. parent catchment) and selectedRegion isn't driving the camera,
    // fit to the focus bbox (once per focus key).
    if (focusRegion?.bbox) {
      const focusKey = `${level}:${focusRegion.code}`
      if (lastFocusKeyRef.current !== focusKey) {
        const b = focusRegion.bbox
        if (
          Array.isArray(b) &&
          b.length === 4 &&
          b[0] >= -180 &&
          b[0] <= 180 &&
          b[1] >= -90 &&
          b[1] <= 90 &&
          b[2] >= -180 &&
          b[2] <= 180 &&
          b[3] >= -90 &&
          b[3] <= 90
        ) {
          mapbox.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 750 })
          lastFocusKeyRef.current = focusKey
          didFitRef.current[level] = true
          return
        }
      }
    }
    
    // Otherwise, fit to all regions (only once per level on initial load)
    // Don't refit if user has already interacted with the map (zoomed/panned) or if we've already fitted to a region
    if (didFitRef.current[level]) return
    
    const b = bbox(enriched) as [number, number, number, number]
    // Validate bbox coordinates are in WGS84 range
    if (b[0] >= -180 && b[0] <= 180 && b[1] >= -90 && b[1] <= 90 &&
        b[2] >= -180 && b[2] <= 180 && b[3] >= -90 && b[3] <= 90) {
      mapbox.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 750 })
      didFitRef.current[level] = true
    } else {
      // Fallback to default UK bounds if coordinates are invalid
      mapbox.fitBounds([[-8, 49.5], [2, 61]], { padding: 40, duration: 750 })
      didFitRef.current[level] = true
    }
  }, [mapbox, enriched, level, selectedRegion, focusRegion])

  // Interactivity (hover/click/tooltip) is handled at the <Map /> level via `interactiveLayerIds`
  // in `components/map-scaffold.tsx`. This avoids react-mapbox interactivity gating bugs when
  // switching between ITL1/ITL2/ITL3/LAD.

  // All hooks must be called before any conditional returns
  // Use canonical map color system - semantic separation from UI and chart colors
  const colorRampExpr = useMemo(() => {
    const mapType = getMapType(mapMode, metric)
    const midpoint = mapType === "growth" ? 0 : undefined
    
    // Apply winsorization/clamping if provided
    const effectiveMin = isFinite(clampMin as any) ? clampMin as number : minVal
    const effectiveMax = isFinite(clampMax as any) ? clampMax as number : maxVal
    
    // Pass percentiles for always-positive growth metrics to improve proportionality
    const expr = buildMapboxColorRamp(mapType, [effectiveMin, effectiveMax], midpoint, percentiles)
    console.log(`🎨 [Choropleth] Map color ramp built:`, { 
      mapType, 
      minVal: effectiveMin, 
      maxVal: effectiveMax, 
      metric,
      midpoint,
      usesPercentiles: percentiles !== null
    })
    return expr
  }, [minVal, maxVal, clampMin, clampMax, mapMode, metric, percentiles])
  // Use stable source ID - Mapbox doesn't allow changing source ID after mount
  const sourceId = SOURCE_ID
  const fillLayerId = `${level.toLowerCase()}-fill`
  const lineLayerId = `${level.toLowerCase()}-line`

  // Note: We don't manually remove layers - React's Source/Layer components handle lifecycle
  // Removing layers manually causes conflicts with Source component cleanup

  // Note: Source component handles data updates automatically via data={enriched} prop
  // No need to manually call source.setData() - this causes conflicts with React component lifecycle

  // Conditional rendering (not early return) after all hooks
  if (!show) return null

  // Always render <Source> even while data is loading; use cached data or an empty FC.
  const dataForRender = enriched ?? enrichedCacheRef.current[level] ?? EMPTY_FC

  const parentOutlineFilterCode = useMemo(() => {
    if (!parentOutline) return null
    if (parentOutline.level === "ITL1") {
      return UK_TO_TL[parentOutline.code] ?? null
    }
    return parentOutline.code
  }, [parentOutline])

  return (
    <>
      <Source id={sourceId} type="geojson" data={dataForRender}>
        <Layer
          key={fillLayerId}
          id={fillLayerId}
          type="fill"
          paint={{
            "fill-color": level === "UK" 
              ? "#60a5fa" // Light blue solid fill for UK (Tailwind blue-400)
              : [
                  "case",
                  // Phase 5: Feature-state hover highlighting (GPU-side, instant)
                  ["boolean", ["feature-state", "hover"], false],
                  "#FFD700", // Highlight color on hover
                  [
                    "case",
                    ["==", ["get", "value"], null], "#94a3b8",
                    colorRampExpr as any,
                  ],
                ],
            "fill-opacity": maskSet
              ? ([
                  "case",
                  ["==", ["get", "__inParent"], true],
                  0.72,
                  0.08,
                ] as any)
              : level === "UK" ? 0.5 : 0.72, // Slightly more transparent for UK
          }}
        />
        <Layer
          key={lineLayerId}
          id={lineLayerId}
          type="line"
          paint={{
            "line-color": "#111",
            "line-width": maskSet
              ? ([
                  "case",
                  ["==", ["get", "__inParent"], true],
                  1.25,
                  0.5,
                ] as any)
              : 1.25,
            "line-opacity": maskSet
              ? ([
                  "case",
                  ["==", ["get", "__inParent"], true],
                  1,
                  0.35,
                ] as any)
              : 1,
          }}
        />
      </Source>

      {/* Highlight layer for selected LAD region - rendered FIRST so parent outline goes on top, then we add another highlight on very top */}
        <Layer
        key={`${level}-highlight-base`}
        id={`${level.toLowerCase()}-highlight-base`}
        source={sourceId}
          type="line"
          paint={{
            "line-color": "#ff0066",
            "line-width": [
              "case",
              ["==", ["get", "__selected"], true],
            5,
              0
            ],
          "line-opacity": 1,
          }}
        />

      {/* Parent boundary outline (e.g. ITL1 outline while viewing LADs) */}
      {parentOutline && parentGeoData && parentOutlineFilterCode && (
        <Source
          id={`${SOURCE_ID}-parent-${mapId}-${parentOutline.level}`}
          type="geojson"
          data={parentGeoData}
        >
          {/* Outer glow/halo for visibility */}
          <Layer
            id={`${mapId}-${parentOutline.level.toLowerCase()}-parent-outline-halo`}
            type="line"
            filter={[
              "==",
              ["get", PROPERTY_MAP[parentOutline.level].code],
              parentOutlineFilterCode,
            ] as any}
            paint={{
              "line-color": "#ffffff",
              "line-width": 6,
              "line-opacity": 0.6,
            }}
          />
          {/* Main parent boundary line */}
          <Layer
            id={`${mapId}-${parentOutline.level.toLowerCase()}-parent-outline`}
            type="line"
            filter={[
              "==",
              ["get", PROPERTY_MAP[parentOutline.level].code],
              parentOutlineFilterCode,
            ] as any}
            paint={{
              "line-color": "#2563eb",
              "line-width": 3,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* Selected LAD highlight - rendered LAST (on top of parent outline) with pink border */}
      {/* Outer glow layer - creates the "pop" effect during selection */}
      <Source
        id={`${SOURCE_ID}-highlight-glow-${mapId}`}
        type="geojson"
        data={dataForRender}
      >
        <Layer
          key={`${level}-highlight-glow`}
          id={`${level.toLowerCase()}-highlight-glow`}
          type="line"
          paint={{
            "line-color": "#ff0066",
            "line-width": [
              "case",
              ["==", ["get", "__selected"], true],
              selectionPulse ? 12 : 8, // Expands during pulse
              0
            ],
            "line-opacity": selectionPulse ? 0.4 : 0.2, // Fades during pulse
            "line-blur": selectionPulse ? 6 : 4,
          }}
        />
      </Source>
      
      {/* Main selection highlight */}
      <Source
        id={`${SOURCE_ID}-highlight-top-${mapId}`}
        type="geojson"
        data={dataForRender}
      >
        <Layer
          key={`${level}-highlight-top`}
          id={`${level.toLowerCase()}-highlight-top`}
          type="line"
          paint={{
            "line-color": "#ff0066",
            "line-width": [
              "case",
              ["==", ["get", "__selected"], true],
              selectionPulse ? 7 : 5, // Slightly larger during pulse
              0
            ],
            "line-opacity": 1,
          }}
        />
      </Source>

      {/* Hover tooltip - Recharts style (rendered via React state, updated via requestAnimationFrame) */}
      {hoverInfo && (
        <div
          className="font-sans bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px] z-50 pointer-events-auto"
          style={{ 
            position: "absolute",
            left: hoverInfo.x + 10, 
            top: hoverInfo.y + 10,
            transform: "translate(0, -50%)", // Center vertically on cursor
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {hoverInfo.name}
            </span>
            {hoverInfo.code && (
              <Badge variant="secondary" className="text-xs">
                {hoverInfo.code}
              </Badge>
            )}
            {mapMode === "growth" && (
              <Badge variant="outline" className="text-xs">
                {growthPeriod === 1 
                  ? "YoY"
                  : `${year - growthPeriod}–${year}`}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {(() => {
                  // Calculate color from value using the appropriate ramp
                  let indicatorColor = "#94a3b8" // Gray for no data
                  if (
                    hoverInfo.value !== null &&
                    isFinite(minVal) &&
                    isFinite(maxVal)
                  ) {
                    // Use canonical map color system for tooltip indicator
                    const mapType = getMapType(mapMode, metric)
                    const midpoint = mapType === "growth" ? 0 : undefined
                    indicatorColor = getMapColorForValue({
                      mapType,
                      value: hoverInfo.value,
                      domain: [minVal, maxVal],
                      midpoint,
                    })
                  }
                  return (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: indicatorColor }} 
                    />
                  )
                })()}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {mapMode === "growth" 
                    ? `${metricInfo?.title || metric} Growth Rate${growthPeriod === 1 ? " (YoY)" : ` (${growthPeriod}yr)`}`
                    : metricInfo?.title || metric}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {hoverInfo.value !== null 
                  ? mapMode === "growth"
                    ? `${hoverInfo.value >= 0 ? "+" : ""}${hoverInfo.value.toFixed(1)}%`
                    : formatValue(
                      hoverInfo.value, 
                      metricInfo?.unit || "", 
                      metricInfo?.decimals || 0
                    )
                  : `No data for ${year}`}
              </span>
            </div>
            {(hoverInfo.rank != null && hoverInfo.n != null && hoverInfo.n > 0) ? (
              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                <span>{mapMode === "growth" ? "Growth Rank" : "Rank"}</span>
                <span className="font-medium">
                  {hoverInfo.rank}/{hoverInfo.n}
                  {hoverInfo.percentile != null ? ` • ${Math.round(hoverInfo.percentile)}th pct` : ""}
                </span>
              </div>
            ) : null}
            {(hoverInfo.pinnedName && (hoverInfo.deltaAbs != null || hoverInfo.deltaPct != null)) ? (
              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                <span>Δ vs {hoverInfo.pinnedName}</span>
                <span className="font-medium">
                  {hoverInfo.deltaAbs != null
                    ? mapMode === "growth"
                      ? `${hoverInfo.deltaAbs >= 0 ? "+" : ""}${hoverInfo.deltaAbs.toFixed(1)}pp`
                      : `${hoverInfo.deltaAbs >= 0 ? "+" : ""}${formatValue(
                        hoverInfo.deltaAbs,
                        metricInfo?.unit || "",
                        metricInfo?.decimals || 0
                      )}`
                    : "—"}
                  {hoverInfo.deltaPct != null && mapMode !== "growth"
                    ? ` (${hoverInfo.deltaPct >= 0 ? "+" : ""}${hoverInfo.deltaPct.toFixed(1)}%)`
                    : ""}
                </span>
              </div>
            ) : null}
          </div>
          {/* Navigation button to metric detail page */}
          {hoverInfo.code && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/metric/${metric}?region=${hoverInfo.code}&year=${year}&scenario=${scenario}`)
                }}
              >
                View Details
                <ArrowRight className="h-3 w-3 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
