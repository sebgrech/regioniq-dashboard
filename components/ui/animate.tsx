"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Animation Components - Linear/Stripe-grade motion primitives
 *
 * These components provide consistent, polished animations that
 * match the motion system defined in globals.css.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FADE UP - Primary entrance animation
// ─────────────────────────────────────────────────────────────────────────────
interface FadeUpProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number
  duration?: "fast" | "base" | "slow"
  children: React.ReactNode
}

export function FadeUp({
  delay = 0,
  duration = "base",
  className,
  children,
  style,
  ...props
}: FadeUpProps) {
  const durationMs = {
    fast: 150,
    base: 250,
    slow: 400,
  }[duration]

  return (
    <div
      className={cn("animate-fade-up", className)}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: `${durationMs}ms`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGGER - Auto-staggers children with fade-up animation
// ─────────────────────────────────────────────────────────────────────────────
interface StaggerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Delay between each child in ms */
  interval?: number
  /** Initial delay before first child */
  initialDelay?: number
  children: React.ReactNode
}

export function Stagger({
  interval = 30,
  initialDelay = 0,
  className,
  children,
  ...props
}: StaggerProps) {
  return (
    <div
      className={cn(className)}
      style={{
        "--stagger-interval": `${interval}ms`,
      } as React.CSSProperties}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child

        return (
          <div
            className="animate-fade-up"
            style={{
              animationDelay: `${initialDelay + index * interval}ms`,
            }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGGER GRID - Grid layout with staggered children
// ─────────────────────────────────────────────────────────────────────────────
interface StaggerGridProps extends StaggerProps {
  columns?: 1 | 2 | 3 | 4
  gap?: "sm" | "md" | "lg"
}

export function StaggerGrid({
  columns = 4,
  gap = "md",
  interval = 50,
  initialDelay = 0,
  className,
  children,
  ...props
}: StaggerGridProps) {
  const gapClasses = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
  }

  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div
      className={cn("grid", colClasses[columns], gapClasses[gap], className)}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child

        return (
          <div
            className="animate-fade-up"
            style={{
              animationDelay: `${initialDelay + index * interval}ms`,
            }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TRANSITION - Wraps page content with entrance animation
// ─────────────────────────────────────────────────────────────────────────────
interface PageTransitionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function PageTransition({
  className,
  children,
  ...props
}: PageTransitionProps) {
  return (
    <div className={cn("page-enter", className)} {...props}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT REVEAL - Crossfade from skeleton to content
// ─────────────────────────────────────────────────────────────────────────────
interface ContentRevealProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean
  skeleton?: React.ReactNode
  children: React.ReactNode
}

export function ContentReveal({
  isLoading = false,
  skeleton,
  className,
  children,
  ...props
}: ContentRevealProps) {
  if (isLoading && skeleton) {
    return <>{skeleton}</>
  }

  return (
    <div className={cn("animate-content-reveal", className)} {...props}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING OVERLAY - Dims content while loading (optimistic UI)
// ─────────────────────────────────────────────────────────────────────────────
interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean
  /** Show a spinner in the center */
  showSpinner?: boolean
  children: React.ReactNode
}

export function LoadingOverlay({
  isLoading = false,
  showSpinner = false,
  className,
  children,
  ...props
}: LoadingOverlayProps) {
  return (
    <div
      className={cn("relative", className)}
      data-loading={isLoading}
      {...props}
    >
      <div
        className={cn(
          "transition-opacity duration-150 ease-[cubic-bezier(0.33,1,0.68,1)]",
          isLoading && "opacity-50 pointer-events-none"
        )}
      >
        {children}
      </div>

      {isLoading && showSpinner && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALE ON HOVER - Simple scale effect wrapper
// ─────────────────────────────────────────────────────────────────────────────
interface ScaleOnHoverProps extends React.HTMLAttributes<HTMLDivElement> {
  scale?: number
  children: React.ReactNode
}

export function ScaleOnHover({
  scale = 1.02,
  className,
  children,
  style,
  ...props
}: ScaleOnHoverProps) {
  return (
    <div
      className={cn(
        "transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:scale-[var(--hover-scale)] active:scale-[0.98] active:duration-[50ms]",
        className
      )}
      style={{
        "--hover-scale": scale,
        ...style,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  )
}
