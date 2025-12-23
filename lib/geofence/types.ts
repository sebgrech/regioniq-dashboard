/**
 * Geofencing Types
 * 
 * Core type definitions for catchment analysis / geofencing feature.
 */

import type { Polygon, MultiPolygon, Feature } from "geojson"

/** Draw mode for geofence creation */
export type DrawMode = "circle" | "polygon" | "none"

/** A user-defined geofence (catchment area) */
export interface Geofence {
  id: string
  name?: string
  polygon: Polygon | MultiPolygon
  /** Original draw mode used to create this geofence */
  mode: DrawMode
  /** For circle mode: center coordinates [lng, lat] */
  center?: [number, number]
  /** For circle mode: radius in kilometers */
  radiusKm?: number
  createdAt: Date
}

/** Weight contribution from a single LAD to a geofence */
export interface LADWeight {
  /** LAD code (e.g., "E06000001") */
  code: string
  /** LAD name (e.g., "Hartlepool") */
  name: string
  /** Proportion of LAD area that overlaps with geofence (0-1) */
  weight: number
  /** Area of intersection in square kilometers */
  intersectionAreaKm2: number
  /** Total LAD area in square kilometers */
  ladAreaKm2: number
}

/** Breakdown of a single LAD's contribution to the aggregated result */
export interface LADContribution extends LADWeight {
  /** Population contribution (population × weight) */
  population: number
  /** GDHI contribution (gdhi_total × weight) */
  gdhi: number
  /** Employment contribution (employment × weight) */
  employment: number
}

/** Aggregated result from geofence calculation */
export interface GeofenceResult {
  /** Weighted total population within the geofence */
  population: number
  /** Weighted total GDHI (Gross Disposable Household Income) in £ */
  gdhi_total: number
  /** Weighted total employment (jobs) within the geofence */
  employment: number
  /** Number of LADs that contribute to this geofence */
  regions_used: number
  /** Year of the data */
  year: number
  /** Scenario used for forecasts */
  scenario: string
  /** Per-LAD breakdown with weights and contributions */
  breakdown: LADContribution[]
}

/** State for the geofence drawing/calculation workflow */
export interface GeofenceState {
  /** Current draw mode */
  mode: DrawMode
  /** Is drawing currently active? */
  isDrawing: boolean
  /** The current/last drawn geofence */
  geofence: Geofence | null
  /** Calculation result (null if not yet calculated or cleared) */
  result: GeofenceResult | null
  /** Is calculation in progress? */
  isCalculating: boolean
  /** Error message if calculation failed */
  error: string | null
}

/** Props for geofence-enabled map components */
export interface GeofenceMapProps {
  /** Enable geofence drawing controls */
  enableGeofencing?: boolean
  /** Callback when a geofence is created/updated */
  onGeofenceChange?: (geofence: Geofence | null) => void
  /** Callback when geofence calculation completes */
  onGeofenceResult?: (result: GeofenceResult | null) => void
}

/** GeoJSON feature with LAD properties (as used in LAD.geojson) */
export interface LADFeature extends Feature<Polygon | MultiPolygon> {
  properties: {
    LAD24CD: string
    LAD24NM: string
    /** Precomputed bounding box [minLng, minLat, maxLng, maxLat] */
    bbox?: [number, number, number, number]
    [key: string]: unknown
  }
}

/** LAD GeoJSON FeatureCollection */
export interface LADFeatureCollection {
  type: "FeatureCollection"
  features: LADFeature[]
}

