"use client"

import { useEffect, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// FILM GRAIN OVERLAY — "Time Machine" effect
// 
// Creates a subtle noise texture that intensifies as you look at older data.
// The further back in time, the more "aged" the data feels.
// Forecasts (2024+) are crystal clear.
// ─────────────────────────────────────────────────────────────────────────────

interface FilmGrainOverlayProps {
  year: number
  /** The year that marks the boundary between historical and forecast data */
  forecastStartYear?: number
}

export function FilmGrainOverlay({ 
  year, 
  forecastStartYear = 2024 
}: FilmGrainOverlayProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate grain intensity based on how far back in time we are
  // 0% for forecasts (2024+), scales up to max 40% for oldest data (1991)
  const grainOpacity = year >= forecastStartYear 
    ? 0 
    : Math.min(0.35, (forecastStartYear - year) * 0.012)

  // Don't render during SSR or if no grain needed
  if (!mounted || grainOpacity === 0) return null

  return (
    <>
      {/* Noise overlay - uses CSS noise pattern */}
      <div 
        className="pointer-events-none fixed inset-0 z-[9998] mix-blend-overlay transition-opacity duration-700"
        style={{ 
          opacity: grainOpacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
      
      {/* Very subtle sepia/warm tint for older years */}
      {year < forecastStartYear - 10 && (
        <div 
          className="pointer-events-none fixed inset-0 z-[9997] transition-opacity duration-700"
          style={{ 
            opacity: Math.min(0.08, (forecastStartYear - year - 10) * 0.004),
            background: 'linear-gradient(180deg, rgba(139, 119, 101, 0.1) 0%, transparent 50%)',
          }}
        />
      )}
    </>
  )
}

