"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED THEME TOGGLE - Sun/Moon morph animation
// The icon morphs smoothly between sun and moon states
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Ensure this only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const isDark = resolvedTheme === "dark"

  const handleToggle = () => {
    setIsAnimating(true)
    setTheme(isDark ? "light" : "dark")
    
    // Reset animation state after transition completes
    setTimeout(() => setIsAnimating(false), 500)
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted overflow-hidden"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Animated icon container */}
      <div className="relative h-4 w-4">
        {/* Sun icon - visible in dark mode (to switch TO light) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-500 ease-out",
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          )}
        >
          {/* Sun center */}
          <circle cx="12" cy="12" r="4" className="transition-all duration-300" />
          {/* Sun rays - animate in/out */}
          <g className={cn(
            "origin-center transition-all duration-300",
            isDark ? "scale-100 opacity-100" : "scale-0 opacity-0"
          )}>
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </g>
        </svg>

        {/* Moon icon - visible in light mode (to switch TO dark) */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-500 ease-out",
            isDark
              ? "-rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          )}
        >
          {/* Moon crescent */}
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>

      {/* Text label with crossfade */}
      <span className="relative overflow-hidden">
        <span
          className={cn(
            "inline-block transition-all duration-300",
            isDark
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 absolute"
          )}
        >
          Light
        </span>
        <span
          className={cn(
            "inline-block transition-all duration-300",
            isDark
              ? "translate-y-full opacity-0 absolute"
              : "translate-y-0 opacity-100"
          )}
        >
          Dark
        </span>
      </span>
    </button>
  )
}
