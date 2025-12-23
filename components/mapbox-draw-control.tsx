"use client"

/**
 * MapboxDrawControl
 * 
 * Integrates Mapbox GL Draw with the map for polygon/circle drawing.
 * Must be rendered inside a <Map> component from @vis.gl/react-mapbox.
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { useMap } from "@vis.gl/react-mapbox"
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import type { Polygon, MultiPolygon } from "geojson"
import type { DrawMode } from "@/lib/geofence"
import { createCirclePolygon } from "@/lib/geofence"

// Import Mapbox Draw styles
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"

/** Active draw modes (excludes "none") */
type ActiveDrawMode = "circle" | "polygon"

interface MapboxDrawControlProps {
  /** Current draw mode */
  mode: DrawMode
  /** Map ID to attach to */
  mapId: string
  /** Radius in km for circle mode */
  circleRadiusKm?: number
  /** Callback when drawing is complete - only called with active draw modes */
  onDrawComplete: (polygon: Polygon | MultiPolygon, mode: ActiveDrawMode) => void
  /** Callback when drawing is cancelled */
  onDrawCancel?: () => void
  /** Custom draw styles (optional) */
  styles?: object[]
}

// Custom styles for the draw control
const DEFAULT_DRAW_STYLES: object[] = [
  // Polygon fill
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": "#3b82f6",
      "fill-outline-color": "#3b82f6",
      "fill-opacity": 0.15,
    },
  },
  // Polygon outline - active
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3b82f6",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
  // Polygon outline - static (completed)
  {
    id: "gl-draw-polygon-stroke-static",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#2563eb",
      "line-width": 3,
    },
  },
  // Vertex points
  {
    id: "gl-draw-polygon-and-line-vertex-active",
    type: "circle",
    filter: [
      "all",
      ["==", "meta", "vertex"],
      ["==", "$type", "Point"],
      ["!=", "mode", "static"],
    ],
    paint: {
      "circle-radius": 6,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#3b82f6",
      "circle-stroke-width": 2,
    },
  },
  // Midpoints
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "meta", "midpoint"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 4,
      "circle-color": "#3b82f6",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
    },
  },
  // Line while drawing
  {
    id: "gl-draw-line-active",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#3b82f6",
      "line-dasharray": [0.2, 2],
      "line-width": 2,
    },
  },
]

export function MapboxDrawControl({
  mode,
  mapId,
  circleRadiusKm = 10,
  onDrawComplete,
  onDrawCancel,
  styles = DEFAULT_DRAW_STYLES,
}: MapboxDrawControlProps) {
  const maps = useMap() as any
  const mapRef = maps?.[mapId] ?? maps?.default ?? maps?.current
  const mapbox = mapRef?.getMap?.() ?? mapRef

  const drawRef = useRef<MapboxDraw | null>(null)
  const modeRef = useRef<DrawMode>("none")
  const circleRadiusRef = useRef(circleRadiusKm)
  const isProcessingRef = useRef(false) // Prevent recursive event handling

  // Keep refs updated
  useEffect(() => {
    modeRef.current = mode
    circleRadiusRef.current = circleRadiusKm
  }, [mode, circleRadiusKm])

  // Handle circle click (place center point)
  const handleCircleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (isProcessingRef.current) return
      if (modeRef.current !== "circle") return

      isProcessingRef.current = true
      
      const center: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      const circleFeature = createCirclePolygon(center, circleRadiusRef.current)
      const polygon = circleFeature.geometry as Polygon

      // Add the circle to the draw control for visualization
      if (drawRef.current) {
        drawRef.current.deleteAll()
        drawRef.current.add({
          type: "Feature",
          properties: {},
          geometry: polygon,
        })
        // Defer mode change
        setTimeout(() => {
          if (drawRef.current) {
            try {
              drawRef.current.changeMode("simple_select")
            } catch {
              // Ignore
            }
          }
          isProcessingRef.current = false
        }, 0)
      } else {
        isProcessingRef.current = false
      }

      onDrawComplete(polygon, "circle")
    },
    [onDrawComplete]
  )

  // Handle polygon draw complete
  const handleDrawCreate = useCallback(
    (e: { features: GeoJSON.Feature[] }) => {
      // Prevent recursive calls
      if (isProcessingRef.current) return
      if (modeRef.current !== "polygon") return

      const feature = e.features[0]
      if (!feature || feature.geometry.type !== "Polygon") return

      isProcessingRef.current = true
      
      const polygon = feature.geometry as Polygon
      
      // Defer mode change to avoid triggering events during the current event handler
      setTimeout(() => {
        if (drawRef.current) {
          try {
            drawRef.current.changeMode("simple_select")
          } catch {
            // Ignore errors during mode change
          }
        }
        isProcessingRef.current = false
      }, 0)

      onDrawComplete(polygon, "polygon")
    },
    [onDrawComplete]
  )

  // Handle draw update (when user edits the shape)
  const handleDrawUpdate = useCallback(
    (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0]
      if (!feature) return

      // At this point, mode is always "circle" or "polygon" (not "none")
      const activeMode = modeRef.current === "none" ? "polygon" : modeRef.current

      if (feature.geometry.type === "Polygon") {
        onDrawComplete(feature.geometry as Polygon, activeMode)
      } else if (feature.geometry.type === "MultiPolygon") {
        onDrawComplete(feature.geometry as MultiPolygon, activeMode)
      }
    },
    [onDrawComplete]
  )

  // Handle escape key to cancel
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && modeRef.current !== "none") {
        if (drawRef.current) {
          drawRef.current.deleteAll()
          drawRef.current.changeMode("simple_select")
        }
        onDrawCancel?.()
      }
    },
    [onDrawCancel]
  )

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!mapbox) return

    // Create draw control
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {}, // No default controls, we handle everything
      styles: styles as any,
      defaultMode: "simple_select",
    })

    drawRef.current = draw

    // Add draw control to map
    mapbox.addControl(draw, "top-left")

    // Event listeners
    mapbox.on("draw.create", handleDrawCreate)
    mapbox.on("draw.update", handleDrawUpdate)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      try {
        mapbox.off("draw.create", handleDrawCreate)
        mapbox.off("draw.update", handleDrawUpdate)
        mapbox.removeControl(draw)
      } catch {
        // Ignore cleanup errors
      }
      drawRef.current = null
    }
  }, [mapbox, styles, handleDrawCreate, handleDrawUpdate, handleKeyDown])

  // Handle circle mode click
  useEffect(() => {
    if (!mapbox) return

    if (mode === "circle") {
      mapbox.on("click", handleCircleClick)
      mapbox.getCanvas().style.cursor = "crosshair"
    } else {
      mapbox.off("click", handleCircleClick)
      if (mode === "none") {
        mapbox.getCanvas().style.cursor = ""
      }
    }

    return () => {
      try {
        mapbox.off("click", handleCircleClick)
      } catch {
        // Ignore
      }
    }
  }, [mapbox, mode, handleCircleClick])

  // Handle mode changes
  useEffect(() => {
    if (!drawRef.current || !mapbox) return

    switch (mode) {
      case "polygon":
        // Clear any existing shapes and start drawing
        drawRef.current.deleteAll()
        drawRef.current.changeMode("draw_polygon")
        mapbox.getCanvas().style.cursor = "crosshair"
        break
      case "circle":
        // Clear shapes, circle is handled via click
        drawRef.current.deleteAll()
        drawRef.current.changeMode("simple_select")
        // Cursor set in circle click effect
        break
      case "none":
      default:
        drawRef.current.changeMode("simple_select")
        mapbox.getCanvas().style.cursor = ""
        break
    }
  }, [mode, mapbox])

  // This component doesn't render anything visible
  return null
}

/**
 * Hook to get access to the draw control imperatively
 */
export function useMapboxDraw(mapId: string) {
  const maps = useMap() as any
  const mapRef = maps?.[mapId] ?? maps?.default ?? maps?.current
  const mapbox = mapRef?.getMap?.() ?? mapRef

  const clearDraw = useCallback(() => {
    if (!mapbox) return

    // Find and clear the draw control
    const controls = (mapbox as any)._controls || []
    for (const control of controls) {
      if (control instanceof MapboxDraw) {
        control.deleteAll()
        control.changeMode("simple_select")
        break
      }
    }
  }, [mapbox])

  return { clearDraw }
}

