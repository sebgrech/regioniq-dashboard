/**
 * Geofencing Types
 * 
 * Core type definitions for catchment analysis / geofencing feature.
 * Supports both LAD and MSOA boundary levels.
 */

import type { Polygon, MultiPolygon, Feature } from "geojson"

/** Draw mode for geofence creation */
export type DrawMode = "circle" | "polygon" | "none"

/** Catchment boundary level */
export type CatchmentLevel = "LAD" | "MSOA"

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

/** Weight contribution from a single region to a geofence */
export interface RegionWeight {
  /** Region code (e.g., "E06000001" for LAD or "E02000001" for MSOA) */
  code: string
  /** Region name (e.g., "Hartlepool" or "City of London 001") */
  name: string
  /** Boundary level this weight was calculated against */
  level: CatchmentLevel
  /** Proportion of region area that overlaps with geofence (0-1) */
  weight: number
  /** Area of intersection in square kilometers */
  intersectionAreaKm2: number
  /** Total region area in square kilometers */
  regionAreaKm2: number
  /** For MSOA: the parent LAD code (if available) */
  parentLadCode?: string
}

/** Breakdown of a single region's contribution to the aggregated result */
export interface RegionContribution extends RegionWeight {
  /** Population contribution (population x weight) */
  population: number
  /** GDHI contribution (for LAD: gdhi_total x weight) */
  gdhi: number
  /** Employment contribution (employment x weight) */
  employment: number
  /** GVA contribution in GBP millions (MSOA only, 0 for LAD) */
  gva: number
  /** Raw income value for this region (MSOA only, for variation chart) */
  income: number
}

/** Aggregated result from geofence calculation */
export interface GeofenceResult {
  /** Boundary level used for this calculation */
  level: CatchmentLevel
  /** Weighted total population within the geofence */
  population: number
  /** Weighted total GDHI (Gross Disposable Household Income) in GBP */
  gdhi_total: number
  /** Weighted total employment (jobs) within the geofence */
  employment: number
  /** Weighted total GVA in GBP millions (MSOA only, 0 for LAD) */
  gva: number
  /** Population-weighted average household income in GBP (MSOA only, 0 for LAD) */
  average_income: number
  /** Number of regions that contribute to this geofence */
  regions_used: number
  /** Year of the data */
  year: number
  /** Scenario used for forecasts */
  scenario: string
  /** Per-region breakdown with weights and contributions */
  breakdown: RegionContribution[]
  /** If the system fell back to a different level (e.g. MSOA -> LAD for Scotland/NI) */
  fallbackReason?: string
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

/** GeoJSON feature with normalised region properties */
export interface RegionFeature extends Feature<Polygon | MultiPolygon> {
  properties: {
    /** Normalised region code (LAD24CD or MSOA21CD) */
    code: string
    /** Normalised region name (LAD24NM or MSOA21NM) */
    name: string
    /** Precomputed bounding box [minLng, minLat, maxLng, maxLat] */
    bbox?: [number, number, number, number]
    [key: string]: unknown
  }
}

/** Region GeoJSON FeatureCollection with normalised properties */
export interface RegionFeatureCollection {
  type: "FeatureCollection"
  features: RegionFeature[]
}

// ---------------------------------------------------------------------------
// Backwards-compatible aliases (for consumers that still import old names)
// ---------------------------------------------------------------------------

/** @deprecated Use RegionWeight instead */
export type LADWeight = RegionWeight
/** @deprecated Use RegionContribution instead */
export type LADContribution = RegionContribution
/** @deprecated Use RegionFeature instead */
export type LADFeature = RegionFeature
/** @deprecated Use RegionFeatureCollection instead */
export type LADFeatureCollection = RegionFeatureCollection
