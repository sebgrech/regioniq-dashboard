"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Copy, 
  Check, 
  ChevronDown, 
  Building2,
  Sun,
  Users,
  Home,
  TrendingUp,
  Briefcase,
  ShoppingBag,
  MapPin,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SignalChip } from "@/components/place-insights/signal-chip"

// =============================================================================
// Types
// =============================================================================

interface PlaceInsightsProps {
  regionCode: string
  regionName: string
  year: number
  scenario: "baseline" | "upside" | "downside"
}

interface SignalForUI {
  id: string
  label: string
  outcome: "high" | "low" | "neutral" | "rising" | "falling"
  strength: 1 | 2 | 3
  detail: string
}

interface UIBlock {
  bucketLabel?: string
  dominantSignalId: string
  verdictSentence: string
  verdictVisual: { type: "boundary" | "outputVsJobs" | "workforceSlack" | "weekdayPull"; payload?: { outcome?: string } }
  icCopyText: string
  signals: SignalForUI[]
}

interface PlaceInsightsResponse {
  placeCharacter: {
    conclusions: string[]
    archetype: { label: string } | null
  }
  pressureAndSlack: {
    conclusions: string[]
  }
  implications: {
    id: string
    text: string
    relevantFor: string[]
  }[]
  ui: UIBlock
}

// =============================================================================
// Signal Categories
// =============================================================================

const STRUCTURE_SIGNALS = ["employment_density", "income_capture"]
const CAPACITY_SIGNALS = ["labour_capacity", "productivity_strength", "growth_composition"]

// =============================================================================
// Implication icons based on content/id
// =============================================================================

const IMPLICATION_ICONS: Record<string, typeof Sun> = {
  weekday_demand_high: Sun,
  weekday_demand_low: Sun,
  residential_catchment: Home,
  local_spending_power: ShoppingBag,
  value_leakage: MapPin,
  hiring_constraints: Users,
  labour_availability: Users,
  productivity_led_growth: TrendingUp,
  labour_led_growth: Briefcase,
  employment_growth_leading: TrendingUp,
  residential_pressure_building: Home,
  consumer_hub_opportunity: ShoppingBag,
  tight_market_constraints: Activity,
  growth_opportunity: TrendingUp,
}

function getImplicationIcon(id: string, text: string): typeof Sun {
  // Try by ID first
  if (IMPLICATION_ICONS[id]) return IMPLICATION_ICONS[id]
  
  // Fallback: match by content keywords
  const lowerText = text.toLowerCase()
  if (lowerText.includes("daytime") || lowerText.includes("weekday") || lowerText.includes("footfall")) return Sun
  if (lowerText.includes("hiring") || lowerText.includes("workforce") || lowerText.includes("labour")) return Users
  if (lowerText.includes("residential") || lowerText.includes("housing")) return Home
  if (lowerText.includes("retail") || lowerText.includes("spending") || lowerText.includes("consumer")) return ShoppingBag
  if (lowerText.includes("office") || lowerText.includes("employment")) return Briefcase
  if (lowerText.includes("expansion") || lowerText.includes("growth")) return TrendingUp
  
  return Activity // default
}

// =============================================================================
// Implication Item with slot-machine style hover
// =============================================================================

function ImplicationItem({ text, id }: { text: string; id: string }) {
  const [hovered, setHovered] = useState(false)
  const Icon = getImplicationIcon(id, text)
  
  return (
    <li 
      className={cn(
        "flex items-start gap-3 text-foreground",
        "px-3 py-2.5 -mx-3 rounded-lg",
        "transition-all duration-200 ease-out cursor-default",
        hovered 
          ? "bg-primary/10 scale-[1.01] shadow-sm" 
          : "bg-transparent"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={cn(
        "flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5 transition-colors",
        hovered ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[1.2rem] leading-snug min-w-0">
        {text}
      </span>
    </li>
  )
}

// =============================================================================
// Signal Group Component
// =============================================================================

function SignalGroup({ 
  title, 
  signals, 
  startIndex = 0 
}: { 
  title: string
  signals: SignalForUI[]
  startIndex?: number 
}) {
  if (signals.length === 0) return null
  
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {signals.map((signal, index) => (
          <SignalChip
            key={signal.id}
            label={signal.label}
            strength={signal.strength}
            outcome={signal.outcome}
            detail={signal.detail}
            className={cn(
              "animate-in fade-in-0 slide-in-from-left-2 duration-300",
              `stagger-${startIndex + index + 1}`
            )}
            style={{ animationFillMode: "backwards" }}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function PlaceInsights({
  regionCode,
  regionName,
  year,
  scenario,
}: PlaceInsightsProps) {
  const [data, setData] = useState<PlaceInsightsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRationale, setShowRationale] = useState(false)
  
  useEffect(() => {
    async function fetchInsights() {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch("/api/region-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, year, scenario }),
        })
        
        if (!response.ok) {
          throw new Error("Failed to fetch place insights")
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error("Error fetching place insights:", err)
        setError("Unable to load place insights")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchInsights()
  }, [regionCode, year, scenario])
  
  // Copy to clipboard
  const handleCopy = async () => {
    if (!data?.ui?.icCopyText) return
    try {
      await navigator.clipboard.writeText(data.ui.icCopyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }
  
  // Loading state with premium shimmer
  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-48 skeleton-shimmer rounded" />
            <div className="h-14 skeleton-shimmer rounded-lg" />
            <div className="grid grid-cols-3 gap-0 -mx-6">
              <div className="col-span-1 bg-muted/40 p-5 space-y-3">
                <div className="h-4 w-20 skeleton-shimmer rounded" />
                <div className="h-9 w-full skeleton-shimmer rounded-full" />
                <div className="h-9 w-4/5 skeleton-shimmer rounded-full" />
                <div className="h-4 w-20 skeleton-shimmer rounded mt-4" />
                <div className="h-9 w-full skeleton-shimmer rounded-full" />
              </div>
              <div className="col-span-2 p-5 space-y-2">
                <div className="h-4 w-28 skeleton-shimmer rounded" />
                <div className="h-12 skeleton-shimmer rounded" />
                <div className="h-12 skeleton-shimmer rounded" />
                <div className="h-12 skeleton-shimmer rounded" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Error state
  if (error || !data?.ui) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border border-border/50">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            {error || "No place insights available"}
          </p>
        </CardContent>
      </Card>
    )
  }
  
  const { ui, implications } = data
  
  // Group signals by category
  const structureSignals = ui.signals.filter(s => STRUCTURE_SIGNALS.includes(s.id))
  const capacitySignals = ui.signals.filter(s => CAPACITY_SIGNALS.includes(s.id))
  
  // Build rationale from existing conclusions (max 220 chars)
  const rationale = [
    ...data.placeCharacter.conclusions.slice(0, 1),
    ...data.pressureAndSlack.conclusions.slice(0, 1)
  ].join(" ").slice(0, 220)
  
  return (
    <Card className="bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Header strip */}
        <div className="flex items-center justify-between px-5 py-1.5">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-2xl text-foreground">{regionName}</span>
          </div>
          <div className="flex items-center gap-2">
            {ui.bucketLabel && (
              <Badge variant="outline" className="text-xs font-normal bg-background/50">
                {ui.bucketLabel}
              </Badge>
            )}
            <Button
              size="sm"
              variant={copied ? "default" : "outline"}
              onClick={handleCopy}
              className="h-7 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Verdict (full width) */}
        <div className="px-5 py-1.5">
          <p className="text-[1.3rem] font-semibold text-foreground leading-relaxed">
            {ui.verdictSentence}
          </p>
        </div>
        
        {/* Two-column layout: Signals (33%) | Implications (66%) */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border/50">
          {/* Left: Signals by category (1/3 width, grey background) */}
          <div className="md:col-span-1 bg-muted/40 p-4 space-y-3">
            <SignalGroup 
              title="Structure" 
              signals={structureSignals} 
              startIndex={0}
            />
            <SignalGroup 
              title="Capacity" 
              signals={capacitySignals}
              startIndex={structureSignals.length}
            />
          </div>
          
          {/* Right: What this means (2/3 width) */}
          {implications.length > 0 && (
            <div className="md:col-span-2 p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                What this means
              </p>
              <ol className="space-y-0.5">
                {implications.slice(0, 3).map((impl) => (
                  <ImplicationItem 
                    key={impl.id} 
                    text={impl.text}
                    id={impl.id}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
        
        {/* Why these signals? (collapsed) */}
        {rationale && (
          <div className="border-t border-border/50">
            <button
              onClick={() => setShowRationale(!showRationale)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-2",
                "text-xs text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              <span>Why these signals?</span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform",
                showRationale && "rotate-180"
              )} />
            </button>
            {showRationale && (
              <div className="px-5 pb-0.5 -mt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {rationale}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
