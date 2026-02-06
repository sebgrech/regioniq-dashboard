"use client"

/**
 * useGeofence Hook
 * 
 * React hook for managing geofence state and calculating aggregated metrics.
 * Handles the full lifecycle of drawing, calculating, and displaying results.
 * Supports both LAD and MSOA boundary levels.
 */

import { useState, useCallback, useRef, useEffect } from "react"
import type { Polygon, MultiPolygon } from "geojson"
import type { Scenario } from "@/lib/metrics.config"
import {
  type DrawMode,
  type CatchmentLevel,
  type Geofence,
  type GeofenceResult,
  type GeofenceState,
  createGeofence,
  createCirclePolygon,
  calculateGeofenceResult,
  validateGeofencePolygon,
  loadBoundaries,
} from "@/lib/geofence"

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371 // km
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const aa =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * (sinDLon * sinDLon)
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * c
}

/**
 * Compute centroid for a polygon ring using the standard planar polygon centroid formula.
 * For our use-case (circles approximated by polygons, UK-scale), this is sufficiently stable.
 */
function ringCentroid(ring: [number, number][]): [number, number] | null {
  if (!ring || ring.length < 4) return null // need at least 3 vertices + closure

  let twiceArea = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const cross = x0 * y1 - x1 * y0
    twiceArea += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }

  if (Math.abs(twiceArea) < 1e-12) {
    // Fallback: simple average of vertices (excluding closing point)
    const n = ring.length - 1
    let ax = 0
    let ay = 0
    for (let i = 0; i < n; i++) {
      ax += ring[i][0]
      ay += ring[i][1]
    }
    return [ax / n, ay / n]
  }

  const area6 = 3 * twiceArea // 6A where A = twiceArea/2
  return [cx / area6, cy / area6]
}

interface UseGeofenceOptions {
  /** Data year for metric fetching */
  year: number
  /** Scenario for forecast data */
  scenario: Scenario
  /** Catchment boundary level (LAD or MSOA) */
  level?: CatchmentLevel
  /** Auto-calculate when geofence changes */
  autoCalculate?: boolean
  /** Callback when calculation completes */
  onResult?: (result: GeofenceResult | null) => void
  /** Callback when an error occurs */
  onError?: (error: string) => void
}

interface UseGeofenceReturn {
  /** Current geofence state */
  state: GeofenceState
  /** Set the current draw mode */
  setMode: (mode: DrawMode) => void
  /** Start drawing (enables drawing mode) */
  startDrawing: () => void
  /** Cancel current drawing */
  cancelDrawing: () => void
  /** Set geofence from a polygon (e.g., from Mapbox Draw) */
  setGeofenceFromPolygon: (polygon: Polygon | MultiPolygon, mode?: DrawMode) => void
  /** Set geofence from a circle definition */
  setGeofenceFromCircle: (center: [number, number], radiusKm: number) => void
  /** Clear the current geofence and results */
  clear: () => void
  /** Manually trigger calculation */
  calculate: () => Promise<void>
  /** Preload boundary GeoJSON (call on mount for faster first calculation) */
  preload: () => void
}

const initialState: GeofenceState = {
  mode: "none",
  isDrawing: false,
  geofence: null,
  result: null,
  isCalculating: false,
  error: null,
}

export function useGeofence(options: UseGeofenceOptions): UseGeofenceReturn {
  const {
    year,
    scenario,
    level = "MSOA",
    autoCalculate = true,
    onResult,
    onError,
  } = options
  
  const [state, setState] = useState<GeofenceState>(initialState)
  
  // Track if we should auto-calculate after geofence changes
  const shouldAutoCalculate = useRef(false)
  
  // Set draw mode
  const setMode = useCallback((mode: DrawMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      isDrawing: mode !== "none",
      error: null,
    }))
  }, [])
  
  // Start drawing
  const startDrawing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDrawing: true,
      error: null,
    }))
  }, [])
  
  // Cancel drawing
  const cancelDrawing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDrawing: false,
      mode: "none",
    }))
  }, [])
  
  // Set geofence from polygon
  const setGeofenceFromPolygon = useCallback((
    polygon: Polygon | MultiPolygon,
    mode: DrawMode = "polygon"
  ) => {
    // Validate the polygon
    const validation = validateGeofencePolygon(polygon)
    if (!validation.valid) {
      const error = validation.error || "Invalid polygon"
      setState((prev) => ({ ...prev, error, isDrawing: false }))
      onError?.(error)
      return
    }
    
    const geofence = (() => {
      // If this came from "circle" drawing, enrich with derived center + radius
      if (mode === "circle" && polygon.type === "Polygon") {
        const ring = polygon.coordinates?.[0] as [number, number][] | undefined
        const center = ring ? ringCentroid(ring) : null
        const edge = ring?.[0]

        if (center && edge) {
          const radiusKm = haversineKm(center, edge)
          return createGeofence(polygon, mode, { center, radiusKm })
        }
      }

      return createGeofence(polygon, mode)
    })()
    
    setState((prev) => ({
      ...prev,
      geofence,
      isDrawing: false,
      mode: "none",
      error: null,
      result: null, // Clear previous result
    }))
    
    shouldAutoCalculate.current = autoCalculate
  }, [autoCalculate, onError])
  
  // Set geofence from circle
  const setGeofenceFromCircle = useCallback((
    center: [number, number],
    radiusKm: number
  ) => {
    // Validate radius
    if (radiusKm <= 0) {
      const error = "Radius must be greater than 0"
      setState((prev) => ({ ...prev, error }))
      onError?.(error)
      return
    }
    if (radiusKm > 200) {
      const error = "Radius must be less than 200 km"
      setState((prev) => ({ ...prev, error }))
      onError?.(error)
      return
    }
    
    // Create circle polygon
    const circleFeature = createCirclePolygon(center, radiusKm)
    const polygon = circleFeature.geometry as Polygon
    
    const geofence = createGeofence(polygon, "circle", {
      center,
      radiusKm,
    })
    
    setState((prev) => ({
      ...prev,
      geofence,
      isDrawing: false,
      mode: "none",
      error: null,
      result: null,
    }))
    
    shouldAutoCalculate.current = autoCalculate
  }, [autoCalculate, onError])
  
  // Clear geofence and results
  const clear = useCallback(() => {
    setState(initialState)
    onResult?.(null)
  }, [onResult])
  
  // Calculate aggregation
  const calculate = useCallback(async () => {
    if (!state.geofence) {
      const error = "No geofence to calculate"
      setState((prev) => ({ ...prev, error }))
      onError?.(error)
      return
    }
    
    setState((prev) => ({ ...prev, isCalculating: true, error: null }))
    
    try {
      const result = await calculateGeofenceResult(
        state.geofence,
        year,
        scenario,
        level
      )
      
      setState((prev) => ({
        ...prev,
        result,
        isCalculating: false,
      }))
      
      onResult?.(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Calculation failed"
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isCalculating: false,
      }))
      onError?.(errorMessage)
    }
  }, [state.geofence, year, scenario, level, onResult, onError])
  
  // Preload boundary GeoJSON for the selected level
  const preload = useCallback(() => {
    loadBoundaries(level).catch((error) => {
      console.warn("[useGeofence] Preload failed:", error)
    })
  }, [level])
  
  // Auto-calculate when geofence changes
  useEffect(() => {
    if (shouldAutoCalculate.current && state.geofence && !state.isCalculating) {
      shouldAutoCalculate.current = false
      calculate()
    }
  }, [state.geofence, state.isCalculating, calculate])
  
  // Recalculate when year/scenario/level changes (if we have a geofence)
  useEffect(() => {
    if (state.geofence && state.result && !state.isCalculating) {
      calculate()
    }
    // Only trigger on year/scenario/level changes, not on geofence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, scenario, level])
  
  return {
    state,
    setMode,
    startDrawing,
    cancelDrawing,
    setGeofenceFromPolygon,
    setGeofenceFromCircle,
    clear,
    calculate,
    preload,
  }
}
