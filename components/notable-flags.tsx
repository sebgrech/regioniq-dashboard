"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Copy, Check, Trophy, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DataPoint } from "@/lib/data-service"
import { useMicroConfetti } from "@/components/micro-confetti"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotableFlagsProps {
  regionCode: string
  regionName: string
  year: number
  allMetricsData: { metricId: string; data: DataPoint[] }[]
  isLoading?: boolean
  /** Minimal mode - removes card chrome for embedding in OM-style layouts */
  minimal?: boolean
}

interface PlaceFlag {
  id: string
  type: "extreme" | "surge" | "recovery" | "record"
  metricId: string
  metricName: string
  headline: string
  subline: string
  signal: "positive" | "negative" | "neutral"
  percentile?: number
  sparkline?: number[]
  priority: number
}

interface PlaceFlagsResponse {
  flags: PlaceFlag[]
  hasFlags: boolean
  timestamp: string
}

// -----------------------------------------------------------------------------
// Styling helpers (IC-safe: amber for "negative")
// -----------------------------------------------------------------------------

function toneClasses(signal: PlaceFlag["signal"]) {
  if (signal === "positive") {
    return {
      accent: "bg-emerald-500",
      icon: "text-emerald-600 dark:text-emerald-400",
      text: "text-emerald-800 dark:text-emerald-200",
      muted: "text-emerald-700/70 dark:text-emerald-300/70",
      hover: "hover:bg-emerald-500/5",
      gaugeFill: "fill-emerald-500",
      stroke: "stroke-emerald-500",
      dot: "fill-emerald-500",
    }
  }
  if (signal === "negative") {
    return {
      accent: "bg-amber-500",
      icon: "text-amber-600 dark:text-amber-400",
      text: "text-amber-900 dark:text-amber-200",
      muted: "text-amber-800/70 dark:text-amber-300/70",
      hover: "hover:bg-amber-500/5",
      gaugeFill: "fill-amber-500",
      stroke: "stroke-amber-500",
      dot: "fill-amber-500",
    }
  }
  return {
    accent: "bg-slate-400",
    icon: "text-slate-600 dark:text-slate-400",
    text: "text-slate-900 dark:text-slate-200",
    muted: "text-slate-700/70 dark:text-slate-300/70",
    hover: "hover:bg-muted/40",
    gaugeFill: "fill-slate-400",
    stroke: "stroke-slate-400",
    dot: "fill-slate-400",
  }
}

function typeIcon(flag: PlaceFlag) {
  if (flag.type === "extreme") return Trophy
  if (flag.signal === "positive") return TrendingUp
  if (flag.signal === "negative") return TrendingDown
  return Activity
}

// -----------------------------------------------------------------------------
// Mini visuals (dense + neutral background; proper min/max scaling)
// -----------------------------------------------------------------------------

function MiniSparkline({
  data,
  signal,
}: {
  data: number[]
  signal: PlaceFlag["signal"]
}) {
  if (!data || data.length < 3) return null
  
  const w = 64
  const h = 18
  const pad = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const denom = max - min || 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const t = (v - min) / denom
    const y = h - pad - t * (h - pad * 2)
    return { x, y }
  })

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const tone = toneClasses(signal)
  
  return (
    <svg width={w} height={h} className="block">
      <path
        d={d}
        fill="none"
        className={cn("stroke-[1.5]", tone.stroke)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r={2.2}
        className={cn(tone.dot, "stroke-background stroke-[1.5]")}
      />
    </svg>
  )
}

function PercentileGauge({
  percentile,
  signal,
}: {
  percentile: number
  signal: PlaceFlag["signal"]
}) {
  const w = 64
  const h = 7
  const x = Math.max(3, Math.min(w - 3, (percentile / 100) * w))
  const tone = toneClasses(signal)
  
  return (
    <svg width={w} height={h} className="block">
      <rect x={0} y={0} width={w} height={h} rx={h / 2} className="fill-muted" />
      <rect
        x={0}
        y={0}
        width={(percentile / 100) * w}
        height={h}
        rx={h / 2}
        className={tone.gaugeFill}
      />
      <circle
        cx={x}
        cy={h / 2}
        r={3.6}
        className={cn("stroke-background stroke-[1.5]", tone.gaugeFill)}
      />
    </svg>
  )
}

// -----------------------------------------------------------------------------
// Row (list-style, not “tile-style” — avoids matching Patterns card)
// -----------------------------------------------------------------------------

function FlagRow({ flag, index }: { flag: PlaceFlag; index: number }) {
  const Icon = typeIcon(flag)
  const tone = toneClasses(flag.signal)

  return (
    <div
      className={cn(
        "group relative grid grid-cols-[8px_24px_1fr_80px] items-center gap-3",
        "py-2.5",
        "transition-colors duration-200",
        tone.hover
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      {/* left spine tick */}
      <div className="relative h-full">
        <span
          className={cn(
            "absolute left-[3px] top-[7px] h-[20px] w-[3px] rounded-full",
            tone.accent
          )}
        />
      </div>

      {/* icon */}
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md bg-background/70",
          "border border-border/40",
          "transition-transform duration-200 group-hover:scale-[1.03]",
          tone.icon
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      
      {/* text */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <div className={cn("font-semibold leading-tight truncate text-lg", tone.text)}>
            {flag.headline}
          </div>
          <div className="hidden md:block text-lg text-muted-foreground truncate">
            {flag.metricName}
          </div>
        </div>
        <div className={cn("text-sm leading-snug", tone.muted)}>
          {flag.subline}
        </div>
      </div>
      
      {/* right visual */}
      <div className="justify-self-end opacity-80 group-hover:opacity-95 transition-opacity">
        {flag.percentile !== undefined ? (
          <PercentileGauge percentile={flag.percentile} signal={flag.signal} />
        ) : flag.sparkline && flag.sparkline.length > 0 ? (
          <MiniSparkline data={flag.sparkline} signal={flag.signal} />
        ) : (
          <div className="h-[18px] w-[64px]" />
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function NotableFlags({
  regionCode,
  regionName,
  year,
  allMetricsData,
  isLoading = false,
  minimal = false,
}: NotableFlagsProps) {
  const [response, setResponse] = useState<PlaceFlagsResponse | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { celebrate } = useMicroConfetti()
  const hasCelebratedRef = useRef<Set<string>>(new Set())

  // Stable-ish key to avoid refetch loops if parent recreates arrays frequently
  const metricsKey = useMemo(() => {
    if (!allMetricsData?.length) return "none"
    // Only hashes shape; keeps compute cheap.
    return allMetricsData
      .map((m) => `${m.metricId}:${m.data?.length ?? 0}`)
      .sort()
      .join("|")
  }, [allMetricsData])

  useEffect(() => {
    setResponse(null)
    setCopied(false)
    hasCelebratedRef.current.clear() // Reset celebrations on region change
  }, [regionCode])

  // Trigger micro-confetti when #1 rank is detected (Bloomberg discipline: restrained)
  useEffect(() => {
    if (!response?.flags?.length || !cardRef.current) return
    
    // Find any #1 flags
    const numberOneFlags = response.flags.filter(f => f.headline === "#1")
    
    for (const flag of numberOneFlags) {
      const celebrationKey = `${regionCode}:${flag.metricId}`
      if (hasCelebratedRef.current.has(celebrationKey)) continue
      
      hasCelebratedRef.current.add(celebrationKey)
      
      // Get origin from the card (center of the Notable Flags card)
      const rect = cardRef.current.getBoundingClientRect()
      celebrate(flag.metricId, {
        x: rect.left + rect.width / 2,
        y: rect.top + 60, // Near the top of the card
      })
      
      // Only celebrate one #1 per load (Bloomberg discipline)
      break
    }
  }, [response, regionCode, celebrate])

  useEffect(() => {
    if (isLoading || !allMetricsData || allMetricsData.length === 0) return
    
    const controller = new AbortController()
    
    async function fetchFlags() {
      setIsFetching(true)
      try {
        const res = await fetch("/api/place-flags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, regionName, year, allMetricsData }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Failed to fetch place flags")
        const data: PlaceFlagsResponse = await res.json()
          setResponse(data)
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.error("Place flags fetch error:", e)
          setResponse({ flags: [], hasFlags: false, timestamp: new Date().toISOString() })
        }
      } finally {
          setIsFetching(false)
      }
    }
    
    fetchFlags()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode, regionName, year, metricsKey, isLoading])

  const handleCopy = async () => {
    if (!response?.flags?.length) return
    const text = response.flags.map((f) => `• ${f.headline} — ${f.subline}`).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Copy failed:", err)
    }
  }

  // Loading
  if (isLoading || isFetching) {
    if (minimal) {
      return (
        <div className="space-y-2">
          <div className="h-10 skeleton-shimmer rounded-lg" />
          <div className="h-10 skeleton-shimmer rounded-lg" />
          <div className="h-10 skeleton-shimmer rounded-lg" />
        </div>
      )
    }
    return (
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50">
        <CardHeader className="px-5 pt-4 pb-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Notable Flags
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-1 pb-4">
          <div className="space-y-2">
            <div className="h-12 skeleton-shimmer rounded-lg" />
            <div className="h-12 skeleton-shimmer rounded-lg" />
            <div className="h-12 skeleton-shimmer rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Hide if none (premium behavior)
  if (!response?.hasFlags || !response.flags?.length) return null

  // Minimal mode - no card chrome, quieter styling
  if (minimal) {
    return (
      <div ref={cardRef} className="space-y-1">
        <div className="relative">
          <div className="absolute left-[3px] top-0.5 bottom-0.5 w-px bg-border/30" />
          <div className="divide-y divide-border/10">
            {response.flags.slice(0, 4).map((flag, i) => (
              <div
                key={flag.id}
                className={cn("animate-in fade-in-0 slide-in-from-bottom-2")}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <FlagRow flag={flag} index={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card ref={cardRef} className="bg-card/60 backdrop-blur-sm border border-border/50">
      <CardHeader className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Notable Flags
          </CardTitle>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1.5 text-xs px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-5 pt-0.5 pb-3">
        {/* subtle spine for the whole list to reduce "floating whitespace" */}
        <div className="relative">
          <div className="absolute left-[3px] top-0.5 bottom-0.5 w-px bg-border/40" />
          <div className="divide-y divide-border/15">
            {response.flags.slice(0, 5).map((flag, i) => (
              <div
                key={flag.id}
                className={cn("animate-in fade-in-0 slide-in-from-bottom-2")}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
              >
                <FlagRow flag={flag} index={i} />
              </div>
          ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
