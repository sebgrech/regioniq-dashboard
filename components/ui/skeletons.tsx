"use client"

import { cn } from "@/lib/utils"

/**
 * Premium Skeleton System - Linear/Stripe-grade loading states
 *
 * These skeletons match the exact layout of real content to prevent
 * layout shift and create smooth reveal transitions.
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

// Base skeleton with shimmer
function SkeletonBase({ className, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted/60 skeleton-wave rounded-md",
        className
      )}
      style={style}
      {...props}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC CARD SKELETON - Matches MetricCard exactly
// ─────────────────────────────────────────────────────────────────────────────
export function MetricCardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-6 space-y-4",
        className
      )}
    >
      {/* Header: title + icon */}
      <div className="flex items-start justify-between">
        <SkeletonBase className="h-5 w-32" />
        <SkeletonBase className="h-14 w-14 rounded-lg" />
      </div>

      {/* Value */}
      <SkeletonBase className="h-10 w-28" />

      {/* Change indicator */}
      <div className="flex items-center gap-2">
        <SkeletonBase className="h-5 w-16" />
        <SkeletonBase className="h-4 w-20" />
      </div>

      {/* Sparkline */}
      <SkeletonBase className="h-8 w-full" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART SKELETON - Matches chart cards
// ─────────────────────────────────────────────────────────────────────────────
export function ChartSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-6 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBase className="h-5 w-40" />
          <SkeletonBase className="h-4 w-56" />
        </div>
        <SkeletonBase className="h-8 w-20 rounded-md" />
      </div>

      {/* Chart area with fake axes */}
      <div className="relative h-[300px] mt-4">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between">
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-10" />
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-10" />
          <SkeletonBase className="h-3 w-8" />
        </div>

        {/* Chart body */}
        <div className="ml-14 h-full flex items-end gap-1">
          {/* Fake bar chart / area outline */}
          <div className="flex-1 h-full flex items-end">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="skeleton-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" className="[stop-color:oklch(var(--muted))]" stopOpacity="0.6" />
                  <stop offset="100%" className="[stop-color:oklch(var(--muted))]" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 Q25,60 50,70 T100,50 T150,65 T200,40 T250,55 T300,35 L300,100 L0,100 Z"
                fill="url(#skeleton-gradient)"
                className="skeleton-pulse"
              />
            </svg>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="ml-14 mt-2 flex justify-between">
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-8" />
          <SkeletonBase className="h-3 w-8" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE SKELETON - Matches data tables
// ─────────────────────────────────────────────────────────────────────────────
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className
}: SkeletonProps & { rows?: number; columns?: number }) {
  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-muted/30 border-b p-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonBase
            key={i}
            className={cn(
              "h-4",
              i === 0 ? "w-32" : i === columns - 1 ? "w-20 ml-auto" : "w-24"
            )}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "p-3 flex gap-4 border-b last:border-0",
            rowIndex % 2 === 0 ? "bg-background" : "bg-muted/5"
          )}
          style={{ animationDelay: `${rowIndex * 50}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonBase
              key={colIndex}
              className={cn(
                "h-4",
                colIndex === 0 ? "w-40" : colIndex === columns - 1 ? "w-16 ml-auto" : "w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP SKELETON - Matches map component
// ─────────────────────────────────────────────────────────────────────────────
export function MapSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border overflow-hidden relative",
        className
      )}
    >
      {/* Map area */}
      <div className="h-[400px] bg-muted/30 skeleton-pulse relative">
        {/* Fake UK outline */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <svg viewBox="0 0 100 150" className="h-3/4 w-auto">
            <path
              d="M50,10 Q30,20 35,40 Q25,60 30,80 Q20,100 35,120 Q45,140 55,130 Q70,120 65,100 Q75,80 70,60 Q80,40 65,25 Q55,15 50,10 Z"
              fill="currentColor"
              className="text-muted-foreground"
            />
          </svg>
        </div>

        {/* Controls overlay */}
        <div className="absolute top-4 right-4 space-y-2">
          <SkeletonBase className="h-8 w-8 rounded-md" />
          <SkeletonBase className="h-8 w-8 rounded-md" />
          <SkeletonBase className="h-8 w-8 rounded-md" />
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur rounded-lg p-3 space-y-2">
          <SkeletonBase className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <SkeletonBase className="h-3 w-32" />
          </div>
          <div className="flex justify-between">
            <SkeletonBase className="h-3 w-8" />
            <SkeletonBase className="h-3 w-8" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR SKELETON - Matches filter pills
// ─────────────────────────────────────────────────────────────────────────────
export function FilterBarSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SkeletonBase className="h-9 w-28 rounded-lg" />
      <SkeletonBase className="h-9 w-32 rounded-lg" />
      <SkeletonBase className="h-9 w-24 rounded-lg" />
      <SkeletonBase className="h-9 w-28 rounded-lg" />
      <div className="flex-1" />
      <SkeletonBase className="h-9 w-20 rounded-md" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD SKELETON - Full page layout skeleton
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Metric cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <MapSkeleton />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA EXPLORER SKELETON
// ─────────────────────────────────────────────────────────────────────────────
export function DataExplorerSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <FilterBarSkeleton />
      <TableSkeleton rows={8} columns={6} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT SKELETONS - For inline content
// ─────────────────────────────────────────────────────────────────────────────
export function TextSkeleton({
  lines = 3,
  className
}: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
          style={{ animationDelay: `${i * 30}ms` }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT SKELETON - For single stat displays
// ─────────────────────────────────────────────────────────────────────────────
export function StatSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <SkeletonBase className="h-4 w-20" />
      <SkeletonBase className="h-8 w-28" />
      <SkeletonBase className="h-3 w-16" />
    </div>
  )
}

export { SkeletonBase as Skeleton }
