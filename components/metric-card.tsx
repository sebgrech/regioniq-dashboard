"use client"

import { useState } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

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
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false)

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
        "relative overflow-hidden transition-all duration-200 cursor-pointer group",
        "hover:shadow-lg hover:shadow-primary/10 hover:border-primary/20",
        isHovered && "shadow-lg shadow-primary/10 border-primary/20",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Gradient overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-200",
          "bg-gradient-to-br from-primary/5 to-transparent",
          isHovered && "opacity-100",
        )}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 relative z-10 min-h-[60px]">
        <CardTitle className="text-lg font-medium text-muted-foreground leading-5 flex-1 pr-2">{title}</CardTitle>
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
          {/* Main value */}
          <div className="text-3xl font-bold tracking-tight">{value}</div>

          {/* Change indicator */}
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                "flex items-center space-x-1 text-lg font-medium",
                isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
              )}
            >
              <TrendIcon className="h-4 w-4" />
              <span>{change}</span>
            </div>
            <span className="text-lg text-muted-foreground">vs last year</span>
          </div>

          {/* Sparkline */}
          <div className="h-8 w-full">
            <MiniSparkline data={sparklineData} />
          </div>
        </div>
      </CardContent>

      {/* Click indicator */}
      <div
        className={cn(
          "absolute bottom-2 right-2 opacity-0 transition-opacity duration-200",
          "text-xs text-muted-foreground",
          isHovered && "opacity-100",
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
}

function MiniSparkline({ data, className }: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return <div className={cn("h-full w-full bg-muted/20 rounded", className)} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Create SVG path
  const width = 100
  const height = 32
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })

  const pathData = `M ${points.join(" L ")}`

  return (
    <div className={cn("h-full w-full", className)}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Line - black in light mode, white in dark mode */}
        <path
          d={pathData}
          fill="none"
          className="stroke-black dark:stroke-white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot - black in light mode, white in dark mode */}
        <circle
          cx={points[points.length - 1]?.split(",")[0]}
          cy={points[points.length - 1]?.split(",")[1]}
          r="3"
          className="fill-black dark:fill-white"
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