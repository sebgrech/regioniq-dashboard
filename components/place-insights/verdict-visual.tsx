"use client"

import { cn } from "@/lib/utils"

type VerdictVisualType = "boundary" | "outputVsJobs" | "workforceSlack" | "weekdayPull"

interface VerdictVisualProps {
  type: VerdictVisualType
  payload?: { outcome?: string }
  className?: string
}

/**
 * VerdictVisual - Minimal inline SVG glyphs for place character
 * ONE visual = ONE claim = ONE highlighted state
 */
export function VerdictVisual({ type, payload, className }: VerdictVisualProps) {
  const isHigh = payload?.outcome === "high"
  const isLow = payload?.outcome === "low"
  
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {type === "boundary" && <BoundaryGlyph isHigh={isHigh} />}
      {type === "outputVsJobs" && <OutputVsJobsGlyph isHigh={isHigh} />}
      {type === "workforceSlack" && <WorkforceSlackGlyph isLow={isLow} />}
      {type === "weekdayPull" && <WeekdayPullGlyph isHigh={isHigh} />}
    </div>
  )
}

/**
 * Boundary: 3-state indicator showing where value accrues
 * - isHigh = captured locally (dot inside)
 * - neutral = mixed (dot on ring)
 * - isLow = accrues elsewhere (dot outside)
 * 
 * Shows ONLY the active state - others are inactive/outline
 */
function BoundaryGlyph({ isHigh }: { isHigh: boolean }) {
  // Determine state: inside, mixed, or outside
  const state = isHigh ? "inside" : "outside"
  
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
        {/* Boundary ring */}
        <circle 
          cx="36" cy="36" r="24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeDasharray="3 2"
          className="text-muted-foreground/50"
        />
        
        {/* Dot position based on state */}
        {state === "inside" && (
          <circle 
            cx="36" cy="36" r="8"
            className="fill-emerald-500"
          />
        )}
        {state === "outside" && (
          <circle 
            cx="58" cy="36" r="6"
            className="fill-amber-500"
          />
        )}
      </svg>
      
      {/* Single active label - not both */}
      <span className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded",
        state === "inside" 
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      )}>
        {state === "inside" ? "Captured locally" : "Accrues elsewhere"}
      </span>
    </div>
  )
}

/**
 * OutputVsJobs: Shows relative strength of output vs jobs
 * ONE claim: either output-led or jobs-led
 */
function OutputVsJobsGlyph({ isHigh }: { isHigh: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="64" viewBox="0 0 72 64" className="flex-shrink-0">
        {/* Output bar (left) */}
        <rect 
          x="16" 
          y={isHigh ? 8 : 20} 
          width="16" 
          height={isHigh ? 44 : 32}
          rx="3"
          className={cn(
            "transition-all duration-300",
            isHigh ? "fill-emerald-500" : "fill-muted-foreground/40"
          )}
        />
        {/* Jobs bar (right) */}
        <rect 
          x="40" 
          y="20" 
          width="16" 
          height="32"
          rx="3"
          className={cn(
            "transition-all duration-300",
            !isHigh ? "fill-primary" : "fill-primary/40"
          )}
        />
        {/* Labels */}
        <text x="24" y="60" textAnchor="middle" className="fill-muted-foreground text-[8px]">
          Output
        </text>
        <text x="48" y="60" textAnchor="middle" className="fill-muted-foreground text-[8px]">
          Jobs
        </text>
      </svg>
      
      <span className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded",
        isHigh 
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
      )}>
        {isHigh ? "Output leads" : "Jobs lead"}
      </span>
    </div>
  )
}

/**
 * WorkforceSlack: Shows capacity available vs constrained
 * ONE claim: either capacity available or constrained
 */
function WorkforceSlackGlyph({ isLow }: { isLow: boolean }) {
  // isLow in labour_capacity = slack available = good for hiring
  const hasCapacity = isLow
  
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="56" viewBox="0 0 72 56" className="flex-shrink-0">
        {/* 3 horizontal segments - gauge style */}
        {[0, 1, 2].map((i) => {
          const isFilled = hasCapacity ? i < 1 : i < 3
          return (
            <rect
              key={i}
              x="12"
              y={8 + i * 16}
              width="48"
              height="12"
              rx="6"
              className={cn(
                "transition-all duration-300",
                isFilled 
                  ? hasCapacity 
                    ? "fill-emerald-500/70" 
                    : "fill-amber-500/70"
                  : "fill-muted/30"
              )}
            />
          )
        })}
      </svg>
      
      <span className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded",
        hasCapacity 
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      )}>
        {hasCapacity ? "Capacity available" : "Capacity limited"}
      </span>
    </div>
  )
}

/**
 * WeekdayPull: Employment destination vs residential catchment
 * ONE claim: either jobs draw in or workers export
 */
function WeekdayPullGlyph({ isHigh }: { isHigh: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
        {/* Center core - size indicates draw strength */}
        <circle 
          cx="36" cy="36" 
          r={isHigh ? 16 : 8}
          className={cn(
            "transition-all duration-300",
            isHigh ? "fill-primary" : "fill-muted-foreground/30"
          )}
        />
        
        {/* Outer dots - workers */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180
          const distance = isHigh ? 28 : 26
          const x = 36 + Math.cos(rad) * distance
          const y = 36 + Math.sin(rad) * distance
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isHigh ? 3 : 5}
              className={cn(
                "transition-all duration-300",
                isHigh ? "fill-muted-foreground/30" : "fill-primary/60"
              )}
            />
          )
        })}
      </svg>
      
      <span className={cn(
        "text-[10px] font-medium px-2 py-0.5 rounded",
        isHigh 
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
      )}>
        {isHigh ? "Jobs draw in" : "Workers export"}
      </span>
    </div>
  )
}
