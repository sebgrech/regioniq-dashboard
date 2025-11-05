"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Source, Layer, useMap } from "@vis.gl/react-mapbox"
import { createClient } from "@supabase/supabase-js"
import bbox from "@turf/bbox"

// Static ITL1 polygons from /public
import rawItl1 from "@/public/ITL1_wgs84.geojson" assert { type: "json" }

// Supabase client (env must be set)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface MapOverlaysDynamicProps {
  show: boolean
  metric: string
  year: number
  scenario: string
  onRegionSelect?: (regionSlug: string) => void
}

// ONS region_code -> ITL125CD (TL*)
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

/** Build a 5-stop linear color ramp */
function buildColorRamp(min: number, max: number) {
  if (!isFinite(min) || !isFinite(max) || min === max) {
    return ["literal", "#9ca3af"] as const // fallback gray
  }
  const c = ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"]
  const q1 = min + (max - min) * 0.25
  const q2 = min + (max - min) * 0.5
  const q3 = min + (max - min) * 0.75
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
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; name: string; value: number | null } | null>(null)

  // 1) Fetch Supabase slice
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
          console.error("Supabase fetch error (overlay):", error.message)
          setMetricRows([])
        } else {
          setMetricRows(data ?? [])
        }
      }
    })()
    return () => { cancelled = true }
  }, [metric, year, scenario])

  // 2) Index values by TL code
  const valueIndex = useMemo(() => {
    const idx = new Map<string, number>()
    for (const row of metricRows) {
      const tl = REGION_TO_TL[row.region_code]
      if (tl && row.value != null && isFinite(row.value)) {
        idx.set(tl, row.value)
      }
    }
    return idx
  }, [metricRows])

  // 3) Min/max for ramp
  const [minVal, maxVal] = useMemo(() => {
    let min = Infinity, max = -Infinity
    for (const v of valueIndex.values()) {
      if (v < min) min = v
      if (v > max) max = v
    }
    if (min === Infinity || max === -Infinity) return [NaN, NaN]
    return [min, max]
  }, [valueIndex])

  // 4) Enrich features with values
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

  // 5) Fit to UK once
  useEffect(() => {
    if (!map || didFit.current) return
    const b = bbox(rawItl1 as GeoJSON.FeatureCollection) as [number, number, number, number]
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 750 })
    didFit.current = true
  }, [map])

  // 6) Hover + click
  useEffect(() => {
    if (!map) return

    const handleMove = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature) {
        setHoverInfo({
          x: e.point.x,
          y: e.point.y,
          name: feature.properties?.ITL125NM,
          value: feature.properties?.value ?? null,
        })
      } else {
        setHoverInfo(null)
      }
    }

    const handleLeave = () => setHoverInfo(null)

    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature) {
        const tlCode = feature.properties?.ITL125CD
        const ukSlug = tlCode ? TL_TO_UK[tlCode] ?? tlCode : null
        if (ukSlug && onRegionSelect) onRegionSelect(ukSlug)

        const b = bbox(feature) as [number, number, number, number]
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 600 })
      }
    }

    map.on("mousemove", "itl1-fill", handleMove)
    map.on("mouseleave", "itl1-fill", handleLeave)
    map.on("click", "itl1-fill", handleClick)

    map.on("mouseenter", "itl1-fill", () => { map.getCanvas().style.cursor = "pointer" })
    map.on("mouseleave", "itl1-fill", () => { map.getCanvas().style.cursor = "" })

    return () => {
      map.off("mousemove", "itl1-fill", handleMove)
      map.off("mouseleave", "itl1-fill", handleLeave)
      map.off("click", "itl1-fill", handleClick)
    }
  }, [map, onRegionSelect])

  if (!map || !show) return null

  const colorRampExpr = useMemo(() => buildColorRamp(minVal, maxVal), [minVal, maxVal])

  return (
    <>
      <Source id="itl1-dynamic" type="geojson" data={enriched}>
        <Layer
          id="itl1-fill"
          type="fill"
          paint={{
            "fill-color": [
              "case",
              ["==", ["get", "value"], null], "#94a3b8",
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

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="absolute bg-card/95 text-xs p-2 rounded border shadow"
          style={{ left: hoverInfo.x + 10, top: hoverInfo.y + 10 }}
        >
          <div className="font-medium">{hoverInfo.name}</div>
          <div>{hoverInfo.value !== null ? hoverInfo.value.toLocaleString() : "No data"}</div>
        </div>
      )}
    </>
  )
}
