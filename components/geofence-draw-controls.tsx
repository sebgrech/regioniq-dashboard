"use client"

/**
 * GeofenceDrawControls
 * 
 * UI controls for drawing geofences (catchment areas) on the map.
 * Provides buttons to toggle draw modes (circle/polygon) and displays
 * current drawing state.
 */

import { useState } from "react"
import { Circle, Pentagon, X, Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { DrawMode, GeofenceState } from "@/lib/geofence"

interface GeofenceDrawControlsProps {
  /** Current geofence state */
  state: GeofenceState
  /** Callback to set draw mode */
  onSetMode: (mode: DrawMode) => void
  /** Callback to clear the geofence */
  onClear: () => void
  /** Whether the map is ready for drawing */
  isMapReady?: boolean
  /** Custom class name */
  className?: string
  /** Compact mode (smaller buttons) */
  compact?: boolean
}

export function GeofenceDrawControls({
  state,
  onSetMode,
  onClear,
  isMapReady = true,
  className,
  compact = false,
}: GeofenceDrawControlsProps) {
  const [circleRadius, setCircleRadius] = useState(10) // Default 10km
  const [isCirclePopoverOpen, setIsCirclePopoverOpen] = useState(false)

  const hasGeofence = !!state.geofence
  const isDrawing = state.isDrawing
  const isCalculating = state.isCalculating

  const handlePolygonClick = () => {
    if (state.mode === "polygon") {
      onSetMode("none")
    } else {
      onSetMode("polygon")
    }
  }

  const handleCircleClick = () => {
    // Circle mode opens a popover to set radius
    setIsCirclePopoverOpen(true)
  }

  const handleCircleConfirm = () => {
    setIsCirclePopoverOpen(false)
    onSetMode("circle")
  }

  const buttonSize = compact ? "sm" : "default"
  const iconSize = compact ? "h-4 w-4" : "h-5 w-5"

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Drawing mode buttons */}
      <div className="flex items-center gap-2">
        {/* Draw Polygon button */}
        <Button
          variant={state.mode === "polygon" ? "default" : "secondary"}
          size={buttonSize}
          onClick={handlePolygonClick}
          disabled={!isMapReady || isCalculating}
          className={cn(
            "transition-all",
            state.mode === "polygon" && "ring-2 ring-primary ring-offset-2"
          )}
        >
          <Pentagon className={cn(iconSize, "mr-2")} />
          {compact ? "Polygon" : "Draw Polygon"}
        </Button>

        {/* Draw Circle button with radius popover */}
        <Popover open={isCirclePopoverOpen} onOpenChange={setIsCirclePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={state.mode === "circle" ? "default" : "secondary"}
              size={buttonSize}
              onClick={handleCircleClick}
              disabled={!isMapReady || isCalculating}
              className={cn(
                "transition-all",
                state.mode === "circle" && "ring-2 ring-primary ring-offset-2"
              )}
            >
              <Circle className={cn(iconSize, "mr-2")} />
              {compact ? "Circle" : "Draw Circle"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Circle Radius</h4>
                <p className="text-xs text-muted-foreground">
                  Set the radius for your catchment circle
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Radius:</span>
                  <Badge variant="secondary" className="font-mono">
                    {circleRadius} km
                  </Badge>
                </div>
                <Slider
                  value={[circleRadius]}
                  onValueChange={([value]) => setCircleRadius(value)}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 km</span>
                  <span>100 km</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsCirclePopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCircleConfirm}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Draw
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Click on the map to place the center of your circle.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear button (only show when there's a geofence) */}
        {hasGeofence && (
          <Button
            variant="ghost"
            size={buttonSize}
            onClick={onClear}
            disabled={isCalculating}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className={cn(iconSize, compact ? "" : "mr-2")} />
            {!compact && "Clear"}
          </Button>
        )}
      </div>

      {/* Status indicator */}
      {(isDrawing || isCalculating || state.error) && (
        <div className="flex items-center gap-2 text-sm">
          {isDrawing && (
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200">
              <Pencil className="h-3 w-3 mr-1" />
              Drawing {state.mode === "circle" ? "circle" : "polygon"}...
            </Badge>
          )}
          {isCalculating && (
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Calculating...
            </Badge>
          )}
          {state.error && (
            <Badge variant="destructive">
              <X className="h-3 w-3 mr-1" />
              {state.error}
            </Badge>
          )}
        </div>
      )}

      {/* Help text when in drawing mode */}
      {isDrawing && !isCalculating && (
        <p className="text-xs text-muted-foreground">
          {state.mode === "polygon" 
            ? "Click to add points. Double-click to complete the shape."
            : "Click on the map to place the center of your circle."}
        </p>
      )}
    </div>
  )
}

/**
 * Compact version of draw controls for use in toolbars
 */
export function GeofenceDrawControlsCompact(
  props: Omit<GeofenceDrawControlsProps, "compact">
) {
  return <GeofenceDrawControls {...props} compact />
}

