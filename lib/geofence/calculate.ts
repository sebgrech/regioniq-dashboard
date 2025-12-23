/**
 * Geofence Calculation Utilities
 * 
 * Client-side spatial calculations using Turf.js for computing
 * intersection weights between a user-drawn geofence and LAD boundaries.
 */

import area from "@turf/area"
import intersect from "@turf/intersect"
import booleanIntersects from "@turf/boolean-intersects"
import circle from "@turf/circle"
import { polygon as turfPolygon, featureCollection } from "@turf/helpers"
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from "geojson"
import type { LADWeight, LADFeature, LADFeatureCollection, Geofence, DrawMode } from "./types"

// Square meters to square kilometers
const SQ_M_TO_SQ_KM = 1e-6

/**
 * Cache for LAD GeoJSON to avoid refetching
 */
let ladGeoJsonCache: LADFeatureCollection | null = null
let ladGeoJsonPromise: Promise<LADFeatureCollection> | null = null

/**
 * Load LAD GeoJSON from cache or fetch it.
 * Uses the same file as the choropleth layer.
 */
export async function loadLADGeoJson(): Promise<LADFeatureCollection> {
  if (ladGeoJsonCache) {
    return ladGeoJsonCache
  }

  if (ladGeoJsonPromise) {
    return ladGeoJsonPromise
  }

  ladGeoJsonPromise = (async () => {
    try {
      // Try CDN first in production
      const useCDN = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_USE_CDN !== "false"
      const url = useCDN
        ? "https://pub-aad6b4b085f8487dbfe1151db5bb3751.r2.dev/boundaries/LAD.geojson"
        : "/boundaries/LAD.geojson"

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load LAD GeoJSON: ${response.status}`)
      }

      const data = (await response.json()) as LADFeatureCollection
      ladGeoJsonCache = data
      console.log(`[Geofence] Loaded ${data.features.length} LAD features`)
      return data
    } catch (error) {
      // Fallback to local file
      console.warn("[Geofence] CDN fetch failed, trying local fallback...")
      const fallbackResponse = await fetch("/boundaries/LAD.geojson")
      if (!fallbackResponse.ok) {
        throw new Error(`Failed to load LAD GeoJSON: ${fallbackResponse.status}`)
      }
      const data = (await fallbackResponse.json()) as LADFeatureCollection
      ladGeoJsonCache = data
      return data
    } finally {
      ladGeoJsonPromise = null
    }
  })()

  return ladGeoJsonPromise
}

/**
 * Clear the LAD GeoJSON cache (for testing/memory management)
 */
export function clearLADCache(): void {
  ladGeoJsonCache = null
  ladGeoJsonPromise = null
}

/**
 * Create a circle polygon from center point and radius.
 * 
 * @param center - [longitude, latitude]
 * @param radiusKm - Radius in kilometers
 * @param steps - Number of points to approximate the circle (default 64)
 */
export function createCirclePolygon(
  center: [number, number],
  radiusKm: number,
  steps = 64
): Feature<Polygon> {
  return circle(center, radiusKm, { steps, units: "kilometers" })
}

/**
 * Create a Geofence object from a drawn polygon.
 */
export function createGeofence(
  polygon: Polygon | MultiPolygon,
  mode: DrawMode,
  options?: {
    name?: string
    center?: [number, number]
    radiusKm?: number
  }
): Geofence {
  return {
    id: `geofence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: options?.name,
    polygon,
    mode,
    center: options?.center,
    radiusKm: options?.radiusKm,
    createdAt: new Date(),
  }
}

/**
 * Calculate the area of a polygon/multipolygon in square kilometers.
 */
export function calculateAreaKm2(geometry: Polygon | MultiPolygon): number {
  const feature: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry,
  }
  return area(feature) * SQ_M_TO_SQ_KM
}

/**
 * Calculate intersection weights between a geofence and all LAD boundaries.
 * 
 * For each LAD that intersects with the geofence, calculates:
 * - The area of intersection
 * - The weight (proportion of LAD area that overlaps)
 * 
 * @param geofence - The user-drawn geofence
 * @param ladGeoJson - LAD boundary FeatureCollection
 * @returns Array of LAD weights (only LADs with weight > 0)
 */
export function calculateLADWeights(
  geofence: Geofence,
  ladGeoJson: LADFeatureCollection
): LADWeight[] {
  const geofenceFeature: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: geofence.polygon,
  }

  const weights: LADWeight[] = []
  const startTime = performance.now()

  for (const ladFeature of ladGeoJson.features) {
    // Quick check: do the features even intersect?
    if (!booleanIntersects(geofenceFeature, ladFeature)) {
      continue
    }

    // Calculate the actual intersection geometry
    const intersection = intersect(
      featureCollection([geofenceFeature, ladFeature as Feature<Polygon | MultiPolygon>])
    )

    if (!intersection) {
      continue
    }

    // Calculate areas
    const intersectionArea = area(intersection) * SQ_M_TO_SQ_KM
    const ladArea = area(ladFeature) * SQ_M_TO_SQ_KM

    // Skip if intersection is negligible (< 0.01 km²)
    if (intersectionArea < 0.01) {
      continue
    }

    // Calculate weight (proportion of LAD area covered)
    const weight = Math.min(1, intersectionArea / ladArea)

    // Skip if weight is negligible (< 0.1%)
    if (weight < 0.001) {
      continue
    }

    weights.push({
      code: ladFeature.properties.LAD24CD,
      name: ladFeature.properties.LAD24NM,
      weight,
      intersectionAreaKm2: intersectionArea,
      ladAreaKm2: ladArea,
    })
  }

  const elapsed = performance.now() - startTime
  console.log(
    `[Geofence] Calculated weights for ${weights.length} LADs in ${elapsed.toFixed(1)}ms`
  )

  // Sort by weight descending
  weights.sort((a, b) => b.weight - a.weight)

  return weights
}

/**
 * Main entry point: Calculate LAD weights for a geofence.
 * Loads LAD GeoJSON if not already cached.
 */
export async function calculateGeofenceWeights(
  geofence: Geofence
): Promise<LADWeight[]> {
  const ladGeoJson = await loadLADGeoJson()
  return calculateLADWeights(geofence, ladGeoJson)
}

/**
 * Validate that a polygon is valid for geofence calculation.
 */
export function validateGeofencePolygon(
  geometry: Polygon | MultiPolygon
): { valid: boolean; error?: string } {
  try {
    // Check it's a valid polygon type
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
      return { valid: false, error: "Geometry must be a Polygon or MultiPolygon" }
    }

    // Check it has coordinates
    if (!geometry.coordinates || geometry.coordinates.length === 0) {
      return { valid: false, error: "Polygon has no coordinates" }
    }

    // Calculate area to check it's not degenerate
    const areaKm2 = calculateAreaKm2(geometry)
    if (areaKm2 < 0.001) {
      return { valid: false, error: "Polygon area is too small (< 0.001 km²)" }
    }

    // Check it's not too large (> 50,000 km² = ~half of England)
    if (areaKm2 > 50000) {
      return { valid: false, error: "Polygon area is too large (> 50,000 km²)" }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Invalid polygon: ${error}` }
  }
}

