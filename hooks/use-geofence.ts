"use client"

/**
 * useGeofence Hook
 * 
 * React hook for managing geofence state and calculating aggregated metrics.
 * Handles the full lifecycle of drawing, calculating, and displaying results.
 */

import { useState, useCallback, useRef, useEffect } from "react"
import type { Polygon, MultiPolygon } from "geojson"
import type { Scenario } from "@/lib/metrics.config"
import {
  type DrawMode,
  type Geofence,
  type GeofenceResult,
  type GeofenceState,
  createGeofence,
  createCirclePolygon,
  calculateGeofenceResult,
  validateGeofencePolygon,
  loadLADGeoJson,
} from "@/lib/geofence"

interface UseGeofenceOptions {
  /** Data year for metric fetching */
  year: number
  /** Scenario for forecast data */
  scenario: Scenario
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
  /** Preload LAD GeoJSON (call on mount for faster first calculation) */
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
  const { year, scenario, autoCalculate = true, onResult, onError } = options
  
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
    
    const geofence = createGeofence(polygon, mode)
    
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
      const result = await calculateGeofenceResult(state.geofence, year, scenario)
      
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
  }, [state.geofence, year, scenario, onResult, onError])
  
  // Preload LAD GeoJSON
  const preload = useCallback(() => {
    loadLADGeoJson().catch((error) => {
      console.warn("[useGeofence] Preload failed:", error)
    })
  }, [])
  
  // Auto-calculate when geofence changes
  useEffect(() => {
    if (shouldAutoCalculate.current && state.geofence && !state.isCalculating) {
      shouldAutoCalculate.current = false
      calculate()
    }
  }, [state.geofence, state.isCalculating, calculate])
  
  // Recalculate when year/scenario changes (if we have a geofence)
  useEffect(() => {
    if (state.geofence && state.result && !state.isCalculating) {
      calculate()
    }
    // Only trigger on year/scenario changes, not on geofence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, scenario])
  
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

