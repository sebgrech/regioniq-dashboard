"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Zap,
  Copy,
  Check,
} from "lucide-react"
import { type Scenario } from "@/lib/metrics.config"
import { type DataPoint } from "@/lib/data-service"
import { cn } from "@/lib/utils"

interface MetricAnalysisNarrativeProps {
  metricId: string
  metricTitle: string
  metricUnit: string
  region: string
  regionName: string
  year: number
  scenario: Scenario
  currentData: DataPoint[]
  allScenariosData: { scenario: string; data: DataPoint[] }[]
  allMetricsData?: { metricId: string; data: DataPoint[] }[]
  isLoading?: boolean
}

interface AnalysisResponse {
  bullets: string[]
  hasAnomalies: boolean
  timestamp: string
}

export function MetricAnalysisNarrative({
  metricId,
  metricTitle,
  region,
  regionName,
  year,
  scenario,
  currentData,
  allScenariosData,
  allMetricsData,
  isLoading = false,
}: MetricAnalysisNarrativeProps) {
  const [response, setResponse] = useState<AnalysisResponse | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch analysis when region/metric changes
  useEffect(() => {
    if (isLoading || currentData.length === 0) return
    
    let cancelled = false
    
    async function fetchAnalysis() {
      setIsFetching(true)
      
      try {
        const res = await fetch("/api/metric-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metricId,
            region,
            regionName,
            year,
            scenario,
            currentData,
            allScenariosData,
            allMetricsData,
          }),
        })
        
        if (!res.ok) throw new Error("Failed to fetch")
        
        const data: AnalysisResponse = await res.json()
        if (!cancelled) {
          setResponse(data)
        }
      } catch (error) {
        console.error("Analysis fetch error:", error)
        if (!cancelled) {
          setResponse({ bullets: [], hasAnomalies: false, timestamp: new Date().toISOString() })
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false)
        }
      }
    }
    
    fetchAnalysis()
    
    return () => {
      cancelled = true
    }
  }, [metricId, region, regionName, year, scenario, currentData, allScenariosData, allMetricsData, isLoading])

  // Reset when region/metric changes
  useEffect(() => {
    setResponse(null)
  }, [region, metricId])

  const handleCopy = async () => {
    if (!response?.bullets.length) return
    const text = response.bullets.join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }

  // Loading state
  if (isLoading || isFetching) {
    return (
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50 h-fit">
        <CardHeader className="pb-1.5 pt-2.5 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick Take
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2.5 pt-0 px-4">
          <div className="h-4 skeleton-shimmer rounded w-4/5" />
        </CardContent>
      </Card>
    )
  }

  // Determine what to show (max 3 bullets)
  const hasAnomalies = response?.hasAnomalies && response.bullets.length > 0
  const bullets = hasAnomalies 
    ? response!.bullets.slice(0, 3) 
    : ["Metric performance in line with national peers"]

  return (
    <Card className="bg-card/60 backdrop-blur-sm border border-border/50 h-fit">
      <CardHeader className="pb-1.5 pt-2.5 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick Take
            <Badge variant="outline" className="text-[10px] font-normal ml-1">
              {metricTitle}
            </Badge>
          </CardTitle>
          {hasAnomalies && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 gap-1 text-xs px-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2.5 pt-0 px-4">
        <ul className="space-y-0.5">
          {bullets.map((bullet, i) => (
            <li 
              key={i}
              className={cn(
                "flex items-start gap-2 text-sm",
                hasAnomalies ? "text-foreground" : "text-muted-foreground",
                "animate-in fade-in-0 slide-in-from-left-2 duration-300"
              )}
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
            >
              <span className={cn(
                "mt-0.5 flex-shrink-0",
                hasAnomalies ? "text-amber-500" : "text-muted-foreground/50"
              )}>•</span>
              <span className={cn("leading-snug", hasAnomalies && "font-medium")}>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
