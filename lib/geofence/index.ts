/**
 * Geofence Module
 * 
 * Client-side geofencing for catchment analysis.
 * Calculates intersection weights between user-drawn polygons and region boundaries
 * (LAD or MSOA), then aggregates metrics based on those weights.
 */

// Types
export type {
  DrawMode,
  CatchmentLevel,
  Geofence,
  RegionWeight,
  RegionContribution,
  GeofenceResult,
  GeofenceState,
  GeofenceMapProps,
  RegionFeature,
  RegionFeatureCollection,
  // Backwards-compatible aliases
  LADWeight,
  LADContribution,
  LADFeature,
  LADFeatureCollection,
} from "./types"

// Calculation utilities
export {
  loadBoundaries,
  clearBoundaryCache,
  createCirclePolygon,
  createGeofence,
  calculateAreaKm2,
  calculateWeights,
  calculateGeofenceWeights,
  validateGeofencePolygon,
  // Backwards-compatible aliases
  loadLADGeoJson,
  clearLADCache,
  calculateLADWeights,
} from "./calculate"

// Aggregation
export {
  calculateGeofenceResult,
  formatGeofenceResult,
} from "./aggregate"
