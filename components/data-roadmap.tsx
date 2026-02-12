"use client"

/**
 * Data Roadmap — Apple-style animated timeline
 *
 * Three phases: Live Now → Q2 2026 → H2 2026
 * Self-contained component, no API / DB dependencies.
 */

import {
  CheckCircle2,
  Clock,
  Rocket,
  Database,
  TrendingUp,
  Home,
  Users,
  Building2,
  MapPin,
  BarChart3,
  Layers,
  ArrowRightLeft,
  Hammer,
  Briefcase,
  CircleDot,
} from "lucide-react"
import { cn } from "@/lib/utils"

// =============================================================================
// Data definitions
// =============================================================================

type Phase = "live" | "q2" | "h2"
type Effort = "Live" | "Low" | "Low — derived" | "Low — free API" | "Medium" | "Medium-High" | "High"

interface DataRow {
  name: string
  coverage: string
  source?: string
  effort: Effort
  icpValue?: string
  icon: React.ElementType
}

interface PhaseConfig {
  id: Phase
  label: string
  sublabel: string
  color: string       // Tailwind color class base (e.g. "emerald")
  bgClass: string
  textClass: string
  borderClass: string
  dotClass: string
  icon: React.ElementType
  items: DataRow[]
}

const PHASES: PhaseConfig[] = [
  {
    id: "live",
    label: "Live Now",
    sublabel: "361 LADs · 1991–2050 forecasts",
    color: "emerald",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/20",
    dotClass: "bg-emerald-500",
    icon: CheckCircle2,
    items: [
      { name: "GDHI per Head", coverage: "361 LADs, 1991–2050", effort: "Live", icon: TrendingUp },
      { name: "GVA", coverage: "361 LADs, 1991–2050", effort: "Live", icon: BarChart3 },
      { name: "Employment", coverage: "361 LADs, 1991–2050", effort: "Live", icon: Users },
      { name: "Population", coverage: "361 LADs, 1991–2050", effort: "Live", icon: Users },
      { name: "GVA per Job (Productivity)", coverage: "Derived", effort: "Live", icon: TrendingUp },
      { name: "Jobs per Resident", coverage: "Derived", effort: "Live", icon: ArrowRightLeft },
    ],
  },
  {
    id: "q2",
    label: "Q2 2026",
    sublabel: "Near-term · Achievable",
    color: "cyan",
    bgClass: "bg-cyan-500/15",
    textClass: "text-cyan-400",
    borderClass: "border-cyan-500/20",
    dotClass: "bg-cyan-500",
    icon: Rocket,
    items: [
      { name: "Sector Employment (SIC splits)", coverage: "BRES via NOMIS", source: "BRES / NOMIS", effort: "Medium", icpValue: "Office, logistics, life sciences", icon: Briefcase },
      { name: "Sector GVA (splits)", coverage: "ONS regional accounts", source: "ONS", effort: "Medium", icpValue: "Sector-specific underwriting", icon: BarChart3 },
      { name: "House Prices", coverage: "Land Registry PPD", source: "Land Registry", effort: "Low", icpValue: "Housebuilders, resi lenders", icon: Home },
      { name: "Price-to-Income Ratio", coverage: "LR + GDHI", source: "Derived", effort: "Low — derived", icpValue: "Housebuilders, affordability plays", icon: TrendingUp },
      { name: "MSOA Granularity", coverage: "Where available", source: "ONS", effort: "Medium-High", icpValue: "Neighbourhood-level analysis", icon: MapPin },
    ],
  },
  {
    id: "h2",
    label: "H2 2026",
    sublabel: "Medium-term · Strategic",
    color: "purple",
    bgClass: "bg-purple-500/15",
    textClass: "text-purple-400",
    borderClass: "border-purple-500/20",
    dotClass: "bg-purple-500",
    icon: Clock,
    items: [
      { name: "Residential Rents", coverage: "VOA PRS", source: "VOA", effort: "Low — free API", icpValue: "BTR, PBSA, resi investors", icon: Home },
      { name: "Rent-to-Income Ratio", coverage: "VOA + GDHI", source: "Derived", effort: "Low — derived", icpValue: "BTR affordability", icon: TrendingUp },
      { name: "Age Bands (25–39, 65+)", coverage: "ONS population", source: "ONS", effort: "Low", icpValue: "PBSA, retirement living", icon: Users },
      { name: "Migration (Internal)", coverage: "ONS", source: "ONS", effort: "Medium", icpValue: "Demand pressure indicator", icon: ArrowRightLeft },
      { name: "Commuting Patterns", coverage: "Census 2021", source: "Census", effort: "Medium", icpValue: "Catchment definition", icon: ArrowRightLeft },
      { name: "Planning Pipeline", coverage: "Glenigan / scraping", source: "Glenigan", effort: "High", icpValue: "Development plays", icon: Hammer },
      { name: "SIC Codes / Companies", coverage: "Companies House + BRES", source: "CH / NOMIS", effort: "Medium", icpValue: "Tenant demand, sector depth", icon: Building2 },
    ],
  },
]

// =============================================================================
// Effort badge
// =============================================================================

function EffortBadge({ effort }: { effort: Effort }) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
  switch (effort) {
    case "Live":
      return <span className={cn(base, "bg-emerald-500/15 text-emerald-400")}>Live</span>
    case "Low":
    case "Low — free API":
    case "Low — derived":
      return <span className={cn(base, "bg-cyan-500/15 text-cyan-400")}>{effort}</span>
    case "Medium":
      return <span className={cn(base, "bg-amber-500/15 text-amber-400")}>{effort}</span>
    case "Medium-High":
      return <span className={cn(base, "bg-orange-500/15 text-orange-400")}>{effort}</span>
    case "High":
      return <span className={cn(base, "bg-red-500/15 text-red-400")}>{effort}</span>
    default:
      return <span className={cn(base, "bg-muted text-muted-foreground")}>{effort}</span>
  }
}

// =============================================================================
// Phase section
// =============================================================================

function PhaseSection({ phase, index }: { phase: PhaseConfig; index: number }) {
  const PhaseIcon = phase.icon

  return (
    <div
      className="relative animate-fade-up"
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: "both" }}
    >
      {/* Timeline connector */}
      {index < PHASES.length - 1 && (
        <div className="absolute left-[19px] top-[56px] bottom-[-40px] w-px bg-gradient-to-b from-border/60 to-border/10" />
      )}

      {/* Phase header */}
      <div className="flex items-center gap-4 mb-5">
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-xl",
          phase.bgClass
        )}>
          <PhaseIcon className={cn("h-5 w-5", phase.textClass)} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground tracking-tight">{phase.label}</h2>
            <span className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
              phase.bgClass, phase.textClass
            )}>
              {phase.items.length} datasets
            </span>
          </div>
          <p className="text-sm text-muted-foreground/60 mt-0.5">{phase.sublabel}</p>
        </div>
      </div>

      {/* Data rows */}
      <div className="ml-[19px] pl-8 border-l border-border/20">
        <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden divide-y divide-border/30">
          {phase.items.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={item.name}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 animate-fade-up"
                style={{ animationDelay: `${index * 150 + (i + 1) * 60}ms`, animationFillMode: "both" }}
              >
                {/* Icon */}
                <div className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0",
                  phase.bgClass
                )}>
                  <Icon className={cn("h-3.5 w-3.5", phase.textClass)} />
                </div>

                {/* Name + coverage */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-tight">{item.name}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{item.coverage}</p>
                </div>

                {/* ICP value (if present) */}
                {item.icpValue && (
                  <div className="hidden md:block min-w-0 max-w-[200px]">
                    <p className="text-xs text-muted-foreground/50 truncate">{item.icpValue}</p>
                  </div>
                )}

                {/* Effort badge */}
                <div className="flex-shrink-0">
                  <EffortBadge effort={item.effort} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main component
// =============================================================================

export function DataRoadmap() {
  const totalDatasets = PHASES.reduce((sum, p) => sum + p.items.length, 0)
  const liveCount = PHASES[0].items.length

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12 animate-fade-up" style={{ animationFillMode: "both" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Data Roadmap</h1>
            <p className="text-sm text-muted-foreground/60">RegionIQ coverage & expansion plan</p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
            <CircleDot className="h-3 w-3" />
            {liveCount} live
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-semibold">
            <Rocket className="h-3 w-3" />
            {PHASES[1].items.length} in Q2
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-400 text-xs font-semibold">
            <Clock className="h-3 w-3" />
            {PHASES[2].items.length} in H2
          </span>
          <span className="text-xs text-muted-foreground/40 ml-1">
            {totalDatasets} total datasets
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-12">
        {PHASES.map((phase, i) => (
          <PhaseSection key={phase.id} phase={phase} index={i} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-16 pt-8 border-t border-border/20 text-center animate-fade-up"
        style={{ animationDelay: "800ms", animationFillMode: "both" }}
      >
        <p className="text-xs text-muted-foreground/40">
          All data sourced from ONS, VOA, Land Registry, NOMIS & Census 2021.
          <br />
          Coverage: 361 Local Authority Districts across England & Wales.
        </p>
      </div>
    </div>
  )
}
