"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface SignalRobustness {
  id: string
  label: string
  robustness: "all" | "baseline" | "mixed"
}

interface ScenarioRobustnessProps {
  regionCode: string
  year: number
  scenario: "baseline" | "upside" | "downside"
}

const SIGNAL_LABELS: Record<string, string> = {
  employment_density: "Job draw",
  income_capture: "Income retention",
  labour_capacity: "Workforce capacity",
  productivity_strength: "Output per job",
  growth_composition: "Growth balance"
}

function RobustnessIndicator({ robustness }: { robustness: "all" | "baseline" | "mixed" }) {
  if (robustness === "all") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">●●●</span>
        <span className="text-xs text-muted-foreground">All scenarios</span>
      </div>
    )
  }
  if (robustness === "baseline") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">●●○</span>
        <span className="text-xs text-muted-foreground">Baseline only</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">●○○</span>
      <span className="text-xs text-muted-foreground">Scenario-dependent</span>
    </div>
  )
}

/**
 * ScenarioRobustness - Lightweight panel showing signal stability across scenarios
 * 
 * Displays whether each signal holds in all scenarios or only baseline.
 * Helps analysts understand forecast sensitivity.
 */
export function ScenarioRobustness({
  regionCode,
  year,
  scenario,
}: ScenarioRobustnessProps) {
  const [signals, setSignals] = useState<SignalRobustness[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRobustness() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/region-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, year, scenario }),
        })
        
        if (!response.ok) throw new Error("Failed to fetch")
        
        const data = await response.json()
        
        // Extract robustness from signals
        const robustnessData: SignalRobustness[] = (data.ui?.signals || []).map((s: any) => ({
          id: s.id,
          label: SIGNAL_LABELS[s.id] || s.label,
          robustness: s.robustness || "mixed"
        }))
        
        setSignals(robustnessData)
      } catch (err) {
        console.error("Error fetching robustness:", err)
        setSignals([])
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchRobustness()
  }, [regionCode, year, scenario])

  // Don't render if no data
  if (!isLoading && signals.length === 0) return null

  // Count robustness levels
  const allCount = signals.filter(s => s.robustness === "all").length
  const baselineCount = signals.filter(s => s.robustness === "baseline").length
  const mixedCount = signals.filter(s => s.robustness === "mixed").length

  return (
    <Card className="bg-card/40 backdrop-blur-sm border border-border/30">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Scenario Robustness
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Shows which signals hold across upside/downside scenarios vs baseline only
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {isLoading ? (
          <div className="h-10 skeleton-shimmer rounded" />
        ) : (
          <div className="space-y-3">
            {/* Summary line */}
            <div className="text-sm text-muted-foreground">
              {allCount === signals.length ? (
                <span className="text-emerald-600 dark:text-emerald-400">All signals hold across scenarios</span>
              ) : mixedCount === signals.length ? (
                <span className="text-slate-500">Signals are scenario-dependent</span>
              ) : (
                <span>{allCount} robust, {baselineCount} baseline-only, {mixedCount} mixed</span>
              )}
            </div>
            
            {/* Signal breakdown - compact grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-2">
              {signals.map((signal) => (
                <div 
                  key={signal.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-2 px-3 rounded-md",
                    "text-sm",
                    signal.robustness === "all" && "bg-emerald-50/50 dark:bg-emerald-900/10",
                    signal.robustness === "baseline" && "bg-amber-50/50 dark:bg-amber-900/10",
                    signal.robustness === "mixed" && "bg-slate-50/50 dark:bg-slate-800/20"
                  )}
                >
                  <span className="truncate text-foreground/80">{signal.label}</span>
                  <span className={cn(
                    "font-mono text-xs flex-shrink-0",
                    signal.robustness === "all" && "text-emerald-600 dark:text-emerald-400",
                    signal.robustness === "baseline" && "text-amber-600 dark:text-amber-400",
                    signal.robustness === "mixed" && "text-slate-500 dark:text-slate-400"
                  )}>
                    {signal.robustness === "all" ? "●●●" : signal.robustness === "baseline" ? "●●○" : "●○○"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

