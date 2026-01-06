"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface SignalChipProps {
  label: string
  strength: 1 | 2 | 3 | 4
  outcome: "high" | "low" | "neutral" | "rising" | "falling" | "extreme" | "extreme_high" | "extreme_low"
  detail?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * SignalChip - Unified traffic light system with purple tier
 * 
 * Dots and color represent the SAME thing:
 * - 1 dot + Red = Low/Falling (weak/bad)
 * - 2 dots + Amber = Neutral (middle/watch)
 * - 3 dots + Green = High/Rising (strong/good)
 * - 4 dots + Purple = Extreme (major outlier, e.g., City of London)
 */
export function SignalChip({ 
  label, 
  strength, 
  outcome, 
  detail,
  className,
  style
}: SignalChipProps) {
  const [showDetail, setShowDetail] = useState(false)
  
  // Unified: strength determines both dots AND color
  const isExtreme = strength === 4  // Extreme → Purple
  const isGood = strength === 3     // High/Rising → Green
  const isCaution = strength === 2  // Neutral → Amber
  const isBad = strength === 1      // Low/Falling → Red
  
  return (
    <div 
      className={cn(
        "group relative inline-flex flex-col gap-1",
        className
      )}
      style={style}
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
    >
      <button
        onClick={() => setShowDetail(!showDetail)}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium",
          "border transition-all duration-200",
          "hover:scale-[1.02] active:scale-[0.98]",
          // Unified: color matches strength
          isExtreme && "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-200",
          isGood && "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200",
          isCaution && "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200",
          isBad && "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200"
        )}
      >
        <span>{label}</span>
        <StrengthDots strength={strength} />
      </button>
      
      {/* Detail tooltip on hover/click */}
      {detail && showDetail && (
        <div className={cn(
          "absolute top-full left-0 mt-1.5 z-20",
          "px-3 py-2 rounded-lg shadow-lg",
          "text-sm text-foreground bg-popover border border-border",
          "w-max max-w-[320px]",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}>
          {detail}
        </div>
      )}
    </div>
  )
}

/**
 * StrengthDots - Unified traffic light dots
 * Color matches strength: 1=red, 2=amber, 3=green, 4=purple
 */
function StrengthDots({ strength }: { strength: 1 | 2 | 3 | 4 }) {
  // Dot color based on strength (unified with chip background)
  const dotColor = strength === 4
    ? "bg-violet-600 dark:bg-violet-400"
    : strength === 3 
      ? "bg-emerald-600 dark:bg-emerald-400"
      : strength === 2 
        ? "bg-amber-600 dark:bg-amber-400"
        : "bg-red-600 dark:bg-red-400"
  
  // For extreme (4), we show 3 filled dots with a special indicator
  const maxDots = strength === 4 ? 3 : 3
  const filledDots = strength === 4 ? 3 : strength
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors",
            i <= filledDots ? dotColor : "bg-current opacity-20"
          )}
        />
      ))}
      {/* Fourth dot for extreme values */}
      {strength === 4 && (
        <div className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-400" />
      )}
    </div>
  )
}
