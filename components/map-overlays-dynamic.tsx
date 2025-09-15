"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Source, Layer, useMap } from "@vis.gl/react-mapbox"
import { createClient } from "@supabase/supabase-js"

// Static ITL1 polygons from /public
import rawItl1 from "@/public/ITL1_wgs84.geojson" assert { type: "json" }

// Supabase client (env must be set)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MapOverlaysDynamicProps {
  show: boolean
  metric: string      // maps to metric_id
  year: number        // maps to period
  scenario: string    // reserved for future (e.g., forecast_version)
  onRegionSelect?: (regionCode: string) => void
}

// ONS (GSS) ITL1 region code (E120...) -> ITL125CD (TL*) used in your GeoJSON
// Verified mapping: TLC North East, TLD North West, TLE Yorkshire & Humber, TLF East Midlands,
// TLG West Midlands, TLH East of England, TLI London, TLJ South East, TLK South West,
// TLL Wales, TLM Scotland, TLN Northern Ireland.
const E120_TO_TL: Record<string, string> = {
  E12000001: "TLC",
  E12000002: "TLD",
  E12000003: "TLE",
  E12000004: "TLF",
  E12000005: "TLG",
  E12000006: "TLH",
  E12000007: "TLI",
  E12000008: "TLJ",
  E12000009: "TLK",
  E12000010: "TLL",
  E12000011: "TLM",
  E12000012: "TLN",
}

/** Extract UK bounds from the file (fast bbox, polygon + multipolygon only) */
function bboxFromFC(fc: GeoJSON.FeatureCollection): [[number, number], [number, number]] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const f of fc.features) {
    if (!f.geometry) continue
    if (f.geometry.type === "Polygon") {
      const rings = f.geometry.coordinates as number[][][]
      for (const [lon, lat] of rings[0]) {
        if (lon < minLon) minLon = lon
        if (lat < minLat) minLat = lat
        if (lon > maxLon) maxLon = lon
        if (lat > maxLat) maxLat = lat
      }
    } else if (f.geometry.type === "MultiPolygon") {
      const polys = f.geometry.coordinates as number[][][][]
      for (const rings of polys) {
        for (const [lon, lat] of rings[0]) {
          if (lon < minLon) minLon = lon
          if (lat < minLat) minLat = lat
          if (lon > maxLon) maxLon = lon
          if (lat > maxLat) maxLat = lat
        }
      }
    }
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

/** Build a 5-stop linear color ramp between min..max */
function buildColorRamp(min: number, max: number) {
  // If all values equal (or undefined), guard to avoid NaNs
  if (!isFinite(min) || !isFinite(max) || min === max) {
    // Return a constant color (still wrapped as a valid expression)
    return ["literal", "#9ca3af"] as const // gray-400
  }
  const c = ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"] // purple ramp
  const q1 = min + (max - min) * 0.25
  const q2 = min + (max - min) * 0.50
  const q3 = min + (max - min) * 0.75

  // Mapbox expression for interpolate expects: number, color pairs
  return [
    "interpolate", ["linear"], ["to-number", ["get", "value"]],
    min, c[0],
    q1,  c[1],
    q2,  c[2],
    q3,  c[3],
    max, c[4],
  ] as const
}

export function MapOverlaysDynamic({
  show,
  metric,
  year,
  scenario,
  onRegionSelect,
}: MapOverlaysDynamicProps) {
  const { current: map } = useMap("default")
  const didFit = useRef(false)

  const [metricRows, setMetricRows] = useState<Array<{ region_code: string; value: number | null }>>([])

  // 1) Fetch slice from Supabase whenever controls change
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from("itl1_latest_all")
        .select("region_code, value")
        .eq("metric_id", metric)
        .eq("period", year)

      if (!cancelled) {
        if (error) {
          // Fail quietly to keep UI stable; polygons will render with fallback color
          console.error("Supabase fetch error (overlay):", error.message)
          setMetricRows([])
        } else {
          setMetricRows(data ?? [])
        }
      }
    })()
    return () => { cancelled = true }
  }, [metric, year, scenario])

  // 2) Index values by GeoJSON code (ITL125CD) for O(1) lookup
  const valueIndex = useMemo(() => {
    const idx = new Map<string, number>()
    for (const row of metricRows) {
      const tl = E120_TO_TL[row.region_code] ?? row.region_code // translate E120.. -> TL*
      if (tl != null && row.value != null && isFinite(row.value)) {
        idx.set(tl, row.value)
      }
    }
    return idx
  }, [metricRows])

  // 3) Compute dynamic min/max for the current slice (for color ramp)
  const [minVal, maxVal] = useMemo(() => {
    let min = Infinity, max = -Infinity
    for (const v of valueIndex.values()) {
      if (v < min) min = v
      if (v > max) max = v
    }
    if (min === Infinity || max === -Infinity) return [NaN, NaN]
    return [min, max]
  }, [valueIndex])

  // 4) Enrich features with { value } in-memory (no file writes)
  const enriched = useMemo(() => {
    const fc = rawItl1 as GeoJSON.FeatureCollection
    const features = fc.features.map((f) => {
      const code = (f.properties as any)?.ITL125CD as string | undefined
      const v = code ? valueIndex.get(code) ?? null : null
      return {
        ...f,
        properties: { ...(f.properties as any), value: v },
      } as GeoJSON.Feature
    })
    return { ...fc, features } as GeoJSON.FeatureCollection
  }, [valueIndex])

  // 5) Fit to UK once when map is ready
  useEffect(() => {
    if (!map || didFit.current) return
    const bounds = bboxFromFC(rawItl1 as GeoJSON.FeatureCollection)
    map.fitBounds(bounds, { padding: 40, duration: 750 })
    didFit.current = true
  }, [map])

  if (!map || !show) return null

  // 6) Build safe paint with null-guard + dynamic ramp
  const colorRampExpr = useMemo(() => buildColorRamp(minVal, maxVal), [minVal, maxVal])

  return (
    <Source id="itl1-dynamic" type="geojson" data={enriched}>
      <Layer
        id="itl1-fill"
        type="fill"
        paint={{
          // If value is null → fallback color; else use dynamic ramp
          "fill-color": [
            "case",
            ["==", ["get", "value"], null], "#94a3b8", // slate-400 fallback for no-data regions
            colorRampExpr as any,
          ],
          "fill-opacity": 0.72,
        }}
      />
      <Layer
        id="itl1-outline"
        type="line"
        paint={{
          "line-color": "#111",
          "line-width": 1.25,
        }}
      />
    </Source>
  )
}
