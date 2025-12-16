"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface RelatedMetricData {
  id: string
  title: string
  sparklineData: number[]
  value: string
  change: string
  changeValue: number
}

interface MetricCardProps {
  id: string
  title: string
  value: string
  change: string
  changeValue: number
  sparklineData: number[]
  icon: LucideIcon
  color: string
  unit: string
  isLoading?: boolean
  href?: string
  className?: string
  onClick?: () => void
  relatedMetrics?: RelatedMetricData[] // Related metrics to show in expanding panel
}

export function MetricCard({
  id,
  title,
  value,
  change,
  changeValue,
  sparklineData,
  icon: Icon,
  color,
  unit,
  isLoading = false,
  href,
  className,
  onClick,
  relatedMetrics = [],
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const hasRelatedMetrics = relatedMetrics.length > 0

  // Debug logging
  useEffect(() => {
    if (id === "emp_total_jobs") {
      console.log("🔍 Employment card debug:", {
        id,
        relatedMetricsCount: relatedMetrics.length,
        relatedMetrics: relatedMetrics.map((rm) => ({
          id: rm.id,
          title: rm.title,
          dataLength: rm.sparklineData.length,
          hasData: rm.sparklineData.length > 0,
        })),
        hasRelatedMetrics,
        isHovered,
      })
    }
  }, [id, relatedMetrics, hasRelatedMetrics, isHovered])

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-medium">
            <Skeleton className="h-6 w-32" />
          </CardTitle>
          <Skeleton className="h-14 w-14 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const isPositive = changeValue >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  const cardContent = (
    <Card
      className={cn(
        "relative transition-all duration-300 cursor-pointer group",
        // Very subtle glassmorphism - barely noticeable
        "backdrop-blur-[2px] bg-card/98 dark:bg-card/96",
        "border-border/60 dark:border-border/50",
        "hover:shadow-lg hover:shadow-primary/10 hover:border-primary/20",
        "hover:bg-card/99 dark:hover:bg-card/97",
        isHovered && "shadow-lg shadow-primary/10 border-primary/20",
        // Allow overflow for expanding panel when it has related metrics
        hasRelatedMetrics ? "overflow-visible" : "overflow-hidden",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Animated gradient background - subtle, based on trend */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500",
          isPositive
            ? "bg-gradient-to-br from-green-500/5 via-transparent to-transparent"
            : "bg-gradient-to-br from-red-500/5 via-transparent to-transparent",
          isHovered && "opacity-100",
        )}
      />
      
      {/* Subtle animated gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500",
          "bg-gradient-to-br from-primary/3 via-transparent to-transparent",
          isHovered && "opacity-100",
        )}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 relative z-10 min-h-[60px]">
        <CardTitle className="text-sm font-medium text-muted-foreground leading-tight tracking-tight flex-1 pr-2">{title}</CardTitle>
        <div
          className={cn(
            "h-14 w-14 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0",
            "bg-primary/10 text-primary",
            isHovered && "bg-primary/20",
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
      </CardHeader>

      <CardContent className="relative z-10 pt-0">
        <div className="space-y-2">
          {/* Main value - larger */}
          <div className="text-4xl font-bold tracking-tight leading-tight">{value}</div>

          {/* Change indicator - tighter labels */}
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                "flex items-center space-x-1 text-base font-semibold",
                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              <span>{change}</span>
            </div>
            <span className="text-xs text-muted-foreground tracking-wide uppercase">vs last year</span>
          </div>

          {/* Sparkline - expands proportionally on hover */}
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isHovered && !hasRelatedMetrics ? "h-12 w-[120%] -ml-[10%]" : "h-8 w-full"
          )}>
            <MiniSparkline data={sparklineData} isExpanded={isHovered && !hasRelatedMetrics} />
          </div>
        </div>
      </CardContent>

      {/* Expanding panel for related metrics - INTEGRATED INTO CARD */}
      {hasRelatedMetrics && (
        <div
          className={cn(
            "border-t border-border/40 transition-all duration-500 ease-out overflow-hidden",
            "bg-card/50 dark:bg-card/50",
            isHovered
              ? "opacity-100 max-h-[280px] py-4 px-6"
              : "opacity-0 max-h-0 py-0 px-6"
          )}
        >
          <div className="space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {id === "emp_total_jobs" 
                ? "Related Labour Market Indicators"
                : id === "population_total"
                ? "Related Population Indicators"
                : "Related Indicators"}
            </div>
            <div className={cn(
              relatedMetrics.length === 1 
                ? "grid grid-cols-1 gap-4" 
                : "grid grid-cols-2 gap-4"
            )}>
              {relatedMetrics.map((relatedMetric) => {
                const isRelatedPositive = relatedMetric.changeValue >= 0
                const RelatedTrendIcon = isRelatedPositive ? TrendingUp : TrendingDown
                
                return (
                  <div key={relatedMetric.id} className="space-y-2">
                    {/* Title */}
                    <div className="text-xs font-medium text-muted-foreground leading-tight tracking-tight">
                      {relatedMetric.title}
                    </div>
                    
                    {/* Value - matching main KPI card style */}
                    <div className="text-2xl font-bold tracking-tight leading-tight">
                      {relatedMetric.value}
                    </div>
                    
                    {/* Change indicator - matching main KPI card style */}
                    <div className="flex items-center space-x-1.5">
                      <div
                        className={cn(
                          "flex items-center space-x-1 text-sm font-semibold",
                          isRelatedPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                        )}
                      >
                        <RelatedTrendIcon className="h-3 w-3" />
                        <span>{relatedMetric.change}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tracking-wide uppercase">vs last year</span>
                    </div>
                    
                    {/* Sparkline - matching main KPI card style */}
                    <div className="h-8 w-full">
                      <MiniSparkline data={relatedMetric.sparklineData} isExpanded={false} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Click indicator */}
      <div
        className={cn(
          "absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 z-20",
          "text-xs text-muted-foreground",
          isHovered && !hasRelatedMetrics && "opacity-100",
        )}
      >
        Click for details →
      </div>
    </Card>
  )

  if (href) {
    return <Link href={href}>{cardContent}</Link>
  }

  return cardContent
}

// Mini sparkline component using SVG
interface MiniSparklineProps {
  data: number[]
  className?: string
  isExpanded?: boolean
}

function MiniSparkline({ data, className, isExpanded = false }: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return <div className={cn("h-full w-full bg-muted/20 rounded", className)} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Adjust dimensions proportionally based on expanded state
  // Maintain aspect ratio: expand both dimensions by ~1.5x
  const width = isExpanded ? 150 : 100
  const height = isExpanded ? 48 : 32
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const pathData = `M ${points.join(" L ")}`

  return (
    <div className={cn("h-full w-full transition-all duration-300", className)}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Optional: Add area fill when expanded for better visibility */}
        {isExpanded && (
          <defs>
            <linearGradient id={`gradient-${data.length}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        
        {/* Area fill (only when expanded) */}
        {isExpanded && (
          <path
            d={`${pathData} L ${width},${height} L 0,${height} Z`}
            fill="url(#gradient-${data.length})"
            className="text-primary"
          />
        )}

        {/* Line - black in light mode, white in dark mode */}
        <path
          d={pathData}
          fill="none"
          className={cn(
            "transition-all duration-300",
            "stroke-black dark:stroke-white"
          )}
          strokeWidth={isExpanded ? "2.5" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points when expanded */}
        {isExpanded && points.map((point, index) => {
          const [x, y] = point.split(",").map(Number)
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2.5"
              className="fill-black dark:fill-white opacity-60"
            />
          )
        })}

        {/* End point dot - larger when expanded */}
        <circle
          cx={points[points.length - 1]?.split(",")[0]}
          cy={points[points.length - 1]?.split(",")[1]}
          r={isExpanded ? "4" : "3"}
          className="fill-black dark:fill-white transition-all duration-300"
        />
      </svg>
    </div>
  )
}

MetricCard.Skeleton = function MetricCardSkeleton() {
  return (
    <Card className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-14 w-14 rounded-lg" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-8 w-full rounded" />
      </div>
    </Card>
  )
}

MetricCard.EmptyState = function MetricCardEmpty({
  message = "No data available",
  icon: Icon = TrendingUp,
}: {
  message?: string
  icon?: LucideIcon
}) {
  return (
    <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
      <div className="w-12 h-12 rounded-lg bg-muted/20 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  )
}