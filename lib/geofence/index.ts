/**
 * Geofence Module
 * 
 * Client-side geofencing for catchment analysis.
 * Calculates intersection weights between user-drawn polygons and LAD boundaries,
 * then aggregates metrics (population, GDHI, employment) based on those weights.
 */

// Types
export type {
  DrawMode,
  Geofence,
  LADWeight,
  LADContribution,
  GeofenceResult,
  GeofenceState,
  GeofenceMapProps,
  LADFeature,
  LADFeatureCollection,
} from "./types"

// Calculation utilities
export {
  loadLADGeoJson,
  clearLADCache,
  createCirclePolygon,
  createGeofence,
  calculateAreaKm2,
  calculateLADWeights,
  calculateGeofenceWeights,
  validateGeofencePolygon,
} from "./calculate"

// Aggregation
export {
  calculateGeofenceResult,
  formatGeofenceResult,
} from "./aggregate"

