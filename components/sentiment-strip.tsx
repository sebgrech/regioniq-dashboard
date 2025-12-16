"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface SentimentStripProps {
  regionName: string
  year: number
  metrics: Array<{
    title: string
    change: number
    changeFormatted: string
  }>
  isLoading?: boolean
}

export function SentimentStrip({ regionName, year, metrics, isLoading }: SentimentStripProps) {
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-3">
        <div className="h-6 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-foreground">
          {regionName} in {year}:
        </span>
        <div className="flex items-center gap-4 flex-wrap">
          {metrics.map((metric, idx) => {
            const isPositive = metric.change > 0
            const isNeutral = metric.change === 0
            const TrendIcon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown

            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{metric.title}</span>
                <div
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    isPositive && "text-green-600 dark:text-green-400",
                    !isPositive && !isNeutral && "text-red-600 dark:text-red-400",
                    isNeutral && "text-muted-foreground",
                  )}
                >
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span>{metric.changeFormatted}</span>
                </div>
                {idx < metrics.length - 1 && (
                  <span className="text-muted-foreground mx-1">•</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

