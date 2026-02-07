/**
 * Geofence Calculation Utilities
 * 
 * Client-side spatial calculations using Turf.js for computing
 * intersection weights between a user-drawn geofence and region boundaries.
 * Supports both LAD and MSOA boundary levels.
 */

import area from "@turf/area"
import intersect from "@turf/intersect"
import booleanIntersects from "@turf/boolean-intersects"
import turfBbox from "@turf/bbox"
import circle from "@turf/circle"
import { featureCollection } from "@turf/helpers"
import type { Feature, Polygon, MultiPolygon } from "geojson"
import type {
  RegionWeight,
  RegionFeature,
  RegionFeatureCollection,
  Geofence,
  DrawMode,
  CatchmentLevel,
} from "./types"

// Square meters to square kilometers
const SQ_M_TO_SQ_KM = 1e-6

// ---------------------------------------------------------------------------
// Boundary configuration per level
// ---------------------------------------------------------------------------

const R2_CDN_BASE = "https://pub-aad6b4b085f8487dbfe1151db5bb3751.r2.dev"

interface BoundaryConfig {
  /** Local path served from /public */
  localPath: string
  /** CDN path for production */
  cdnPath: string
  /** GeoJSON property holding the region code */
  codeProperty: string
  /** GeoJSON property holding the region name */
  nameProperty: string
}

const BOUNDARY_CONFIG: Record<CatchmentLevel, BoundaryConfig> = {
  LAD: {
    localPath: "/boundaries/LAD.geojson",
    cdnPath: `${R2_CDN_BASE}/boundaries/LAD.geojson`,
    codeProperty: "LAD24CD",
    nameProperty: "LAD24NM",
  },
  MSOA: {
    localPath: "/boundaries/MSOA.json",
    cdnPath: `${R2_CDN_BASE}/boundaries/MSOA.json`,
    codeProperty: "MSOA21CD",
    nameProperty: "MSOA21NM",
  },
}

// ---------------------------------------------------------------------------
// MSOA human-readable names (House of Commons Library names)
// ---------------------------------------------------------------------------

let msoaNamesCache: Map<string, string> | null = null
let msoaNamesPromise: Promise<Map<string, string>> | null = null

/**
 * Load the MSOA human-readable names lookup (HCL names).
 * Maps codes like "E02006534" to names like "Hillside" instead of "Adur 001".
 */
async function loadMSOANames(): Promise<Map<string, string>> {
  if (msoaNamesCache) return msoaNamesCache
  if (msoaNamesPromise) return msoaNamesPromise

  msoaNamesPromise = (async () => {
    try {
      const useCDN =
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_USE_CDN !== "false"
      const url = useCDN
        ? `${R2_CDN_BASE}/boundaries/msoa-names.json`
        : "/boundaries/msoa-names.json"

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load MSOA names: ${res.status}`)

      const data: Record<string, string> = await res.json()
      const map = new Map(Object.entries(data))
      msoaNamesCache = map
      console.log(`[Geofence] Loaded ${map.size} MSOA human-readable names`)
      return map
    } catch (error) {
      // Fallback to local file (same pattern as loadBoundaries)
      console.warn("[Geofence] MSOA names CDN fetch failed, trying local fallback...")
      try {
        const fallbackRes = await fetch("/boundaries/msoa-names.json")
        if (!fallbackRes.ok) throw new Error(`Fallback failed: ${fallbackRes.status}`)

        const data: Record<string, string> = await fallbackRes.json()
        const map = new Map(Object.entries(data))
        msoaNamesCache = map
        console.log(`[Geofence] Loaded ${map.size} MSOA names from local fallback`)
        return map
      } catch {
        console.warn("[Geofence] MSOA names load failed entirely, using default names")
        const map = new Map<string, string>()
        msoaNamesCache = map
        return map
      }
    } finally {
      msoaNamesPromise = null
    }
  })()

  return msoaNamesPromise
}

// ---------------------------------------------------------------------------
// GeoJSON cache (per level)
// ---------------------------------------------------------------------------

const boundaryCache = new Map<CatchmentLevel, RegionFeatureCollection>()
const boundaryPromises = new Map<CatchmentLevel, Promise<RegionFeatureCollection>>()

/**
 * Load and normalise boundary GeoJSON for a given level.
 * Caches per level so subsequent calls are instant.
 */
export async function loadBoundaries(
  level: CatchmentLevel
): Promise<RegionFeatureCollection> {
  const cached = boundaryCache.get(level)
  if (cached) return cached

  const inflight = boundaryPromises.get(level)
  if (inflight) return inflight

  const config = BOUNDARY_CONFIG[level]

  const promise = (async (): Promise<RegionFeatureCollection> => {
    try {
      const useCDN =
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_USE_CDN !== "false"
      const url = useCDN ? config.cdnPath : config.localPath

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load ${level} GeoJSON: ${response.status}`)
      }

      const raw = await response.json()
      const normalised = normaliseFeatures(raw, config)

      // Apply human-readable names for MSOA
      if (level === "MSOA") {
        await applyMSOANames(normalised)
      }

      boundaryCache.set(level, normalised)
      console.log(
        `[Geofence] Loaded ${normalised.features.length} ${level} features`
      )
      return normalised
    } catch (error) {
      // Fallback to local file
      console.warn(
        `[Geofence] CDN fetch failed for ${level}, trying local fallback...`
      )
      const fallbackResponse = await fetch(config.localPath)
      if (!fallbackResponse.ok) {
        throw new Error(
          `Failed to load ${level} GeoJSON: ${fallbackResponse.status}`
        )
      }
      const raw = await fallbackResponse.json()
      const normalised = normaliseFeatures(raw, config)

      // Apply human-readable names for MSOA
      if (level === "MSOA") {
        await applyMSOANames(normalised)
      }

      boundaryCache.set(level, normalised)
      return normalised
    } finally {
      boundaryPromises.delete(level)
    }
  })()

  boundaryPromises.set(level, promise)
  return promise
}

/**
 * Normalise GeoJSON feature properties so downstream code can use
 * `feature.properties.code` and `feature.properties.name` regardless of level.
 */
function normaliseFeatures(
  raw: any,
  config: BoundaryConfig
): RegionFeatureCollection {
  const features: RegionFeature[] = (raw.features ?? []).map(
    (f: any): RegionFeature => ({
      ...f,
      properties: {
        ...f.properties,
        code: f.properties[config.codeProperty] ?? "",
        name: f.properties[config.nameProperty] ?? "",
      },
    })
  )

  return { type: "FeatureCollection", features }
}

/**
 * Override MSOA feature names with human-readable HCL names.
 * e.g. "Adur 001" → "Hillside", "Allerdale 012" → "Keswick & Derwent Valley"
 */
async function applyMSOANames(
  fc: RegionFeatureCollection
): Promise<void> {
  const nameMap = await loadMSOANames()
  if (nameMap.size === 0) return

  let overridden = 0
  for (const feature of fc.features) {
    const hclName = nameMap.get(feature.properties.code)
    if (hclName) {
      feature.properties.name = hclName
      overridden++
    }
  }
  console.log(
    `[Geofence] Applied HCL names to ${overridden}/${fc.features.length} MSOA features`
  )
}

/**
 * Clear the boundary cache for a specific level or all levels.
 */
export function clearBoundaryCache(level?: CatchmentLevel): void {
  if (level) {
    boundaryCache.delete(level)
    boundaryPromises.delete(level)
  } else {
    boundaryCache.clear()
    boundaryPromises.clear()
    msoaNamesCache = null
    msoaNamesPromise = null
  }
}

// Keep old name as alias for backwards compat
/** @deprecated Use loadBoundaries('LAD') instead */
export const loadLADGeoJson = () => loadBoundaries("LAD")
/** @deprecated Use clearBoundaryCache('LAD') instead */
export const clearLADCache = () => clearBoundaryCache("LAD")

// ---------------------------------------------------------------------------
// Circle / geofence creation helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Intersection weight calculation
// ---------------------------------------------------------------------------

/**
 * Calculate intersection weights between a geofence and region boundaries.
 *
 * For each region that intersects with the geofence, calculates:
 * - The area of intersection
 * - The weight (proportion of region area that overlaps)
 *
 * Uses a bounding-box pre-filter to skip features that obviously don't overlap
 * before running the expensive Turf intersection. This is critical for MSOA
 * (7,264 features) where it eliminates ~95% of candidates.
 *
 * @param geofence - The user-drawn geofence
 * @param regionGeoJson - Region boundary FeatureCollection (normalised)
 * @param level - The catchment level being used
 * @returns Array of region weights (only regions with weight > 0)
 */
export function calculateWeights(
  geofence: Geofence,
  regionGeoJson: RegionFeatureCollection,
  level: CatchmentLevel
): RegionWeight[] {
  const geofenceFeature: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: geofence.polygon,
  }

  const weights: RegionWeight[] = []
  const startTime = performance.now()

  // Pre-compute the drawn shape's bounding box once
  const [drawnMinX, drawnMinY, drawnMaxX, drawnMaxY] =
    turfBbox(geofenceFeature)

  let bboxSkipped = 0

  for (const regionFeature of regionGeoJson.features) {
    // ---- Cheap AABB overlap check ----
    const [fMinX, fMinY, fMaxX, fMaxY] = turfBbox(regionFeature)
    if (
      fMaxX < drawnMinX ||
      fMinX > drawnMaxX ||
      fMaxY < drawnMinY ||
      fMinY > drawnMaxY
    ) {
      bboxSkipped++
      continue
    }

    // ---- Slightly more expensive topology check ----
    if (!booleanIntersects(geofenceFeature, regionFeature)) {
      continue
    }

    // ---- Expensive: compute actual intersection geometry ----
    const intersection = intersect(
      featureCollection([
        geofenceFeature,
        regionFeature as Feature<Polygon | MultiPolygon>,
      ])
    )

    if (!intersection) {
      continue
    }

    // Calculate areas
    const intersectionArea = area(intersection) * SQ_M_TO_SQ_KM
    const regionArea = area(regionFeature) * SQ_M_TO_SQ_KM

    // Skip if intersection is negligible (< 0.01 km²)
    if (intersectionArea < 0.01) {
      continue
    }

    // Calculate weight (proportion of region area covered)
    const weight = Math.min(1, intersectionArea / regionArea)

    // Skip if weight is negligible (< 0.1%)
    if (weight < 0.001) {
      continue
    }

    weights.push({
      code: regionFeature.properties.code,
      name: regionFeature.properties.name,
      level,
      weight,
      intersectionAreaKm2: intersectionArea,
      regionAreaKm2: regionArea,
    })
  }

  const elapsed = performance.now() - startTime
  console.log(
    `[Geofence] Calculated weights for ${weights.length} ${level} regions in ${elapsed.toFixed(1)}ms ` +
      `(${bboxSkipped} skipped by bbox pre-filter out of ${regionGeoJson.features.length})`
  )

  // Sort by weight descending
  weights.sort((a, b) => b.weight - a.weight)

  return weights
}

// Keep old name as alias
/** @deprecated Use calculateWeights instead */
export const calculateLADWeights = (
  geofence: Geofence,
  geoJson: RegionFeatureCollection
) => calculateWeights(geofence, geoJson, "LAD")

/**
 * Main entry point: Calculate region weights for a geofence.
 * Loads boundary GeoJSON if not already cached.
 */
export async function calculateGeofenceWeights(
  geofence: Geofence,
  level: CatchmentLevel = "LAD"
): Promise<RegionWeight[]> {
  const geoJson = await loadBoundaries(level)
  return calculateWeights(geofence, geoJson, level)
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
      return {
        valid: false,
        error: "Geometry must be a Polygon or MultiPolygon",
      }
    }

    // Check it has coordinates
    if (!geometry.coordinates || geometry.coordinates.length === 0) {
      return { valid: false, error: "Polygon has no coordinates" }
    }

    // Calculate area to check it's not degenerate
    const areaKm2 = calculateAreaKm2(geometry)
    if (areaKm2 < 0.001) {
      return {
        valid: false,
        error: "Polygon area is too small (< 0.001 km\u00B2)",
      }
    }

    // Check it's not too large (> 50,000 km² = ~half of England)
    if (areaKm2 > 50000) {
      return {
        valid: false,
        error: "Polygon area is too large (> 50,000 km\u00B2)",
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: `Invalid polygon: ${error}` }
  }
}
