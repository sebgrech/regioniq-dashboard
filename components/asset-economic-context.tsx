"use client"

import { useEffect, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { 
  MapPin, 
  TrendingUp,
  Building2, 
  Sun, 
  Users, 
  Home, 
  ShoppingBag, 
  Briefcase, 
  Activity,
  Target,
  ArrowRight,
  Banknote
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { VerdictVisual } from "@/components/place-insights/verdict-visual"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { REGIONS } from "@/lib/metrics.config"
import { getSiblings, getRegionInfo, getParent, getPeerLADsWithFallback } from "@/lib/region-hierarchy"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts"
import { useTheme } from "next-themes"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { DemandContextCard } from "@/components/demand-context-card"
import { inferTenantSector, type TenantSector } from "@/lib/tenant-sector"
import { deriveLogisticsImplications, type LogisticsImplication } from "@/lib/insights/logistics-implications"

// =============================================================================
// Types (same as PlaceInsights)
// =============================================================================

interface AssetEconomicContextProps {
  regionCode: string
  regionName: string
  year: number
  scenario: "baseline" | "upside" | "downside"
  /** Optional LAD code for peer comparisons (e.g., E06000055) */
  ladCode?: string
  /** Asset metadata for positioning insights */
  assetType?: string | null
  assetClass?: string | null
  tenant?: string | null
  yieldInfo?: string | null
  /** Hide the LAD comparison charts (render separately via AssetComparisonCharts) */
  hideCharts?: boolean
  /** Hide verdict sentence and signal chips in condensed embeds */
  hideSignalsSummary?: boolean
  /** Inferred tenant sector for future signal tailoring */
  tenantSector?: "retail" | "office" | "residential" | "leisure" | "industrial" | "f_and_b" | "other"
  /** Override primary series colour (default: purple #7c3aed) */
  mainColor?: string
  /** Override peer series colours */
  peerColors?: string[]
}

export interface SignalForUI {
  id: string
  label: string
  outcome: "high" | "low" | "neutral" | "rising" | "falling" | "extreme" | "extreme_high" | "extreme_low"
  strength: 1 | 2 | 3 | 4
  detail: string
  robustness?: "all" | "baseline" | "mixed"
}

interface UIBlock {
  bucketLabel?: string
  dominantSignalId: string
  verdictSentence: string
  verdictVisual: { type: string; payload?: { outcome?: string } }
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

// Signal label mappings for OM-style display
const SIGNAL_LABELS: Record<string, string> = {
  employment_density: "Job draw",
  income_capture: "Income retention",
  labour_capacity: "Labour Availability",
  productivity_strength: "Output per job",
  growth_composition: "Growth balance",
}

// =============================================================================
// Shared Hover Tooltip - Used by SignalChipMini and PositioningBulletItem
// =============================================================================

function HoverTooltip({ 
  show, 
  children,
  position = "below"
}: { 
  show: boolean
  children: React.ReactNode
  position?: "below" | "above-right"
}) {
  if (!show) return null
  
  return (
    <div className={cn(
      "absolute z-20",
      "px-3 py-2 rounded-lg shadow-lg",
      "text-sm text-foreground bg-popover border border-border",
      "w-max max-w-[280px]",
      "animate-in fade-in-0 zoom-in-95 duration-150",
      position === "below" && "top-full left-0 mt-1.5",
      position === "above-right" && "bottom-full right-0 mb-1.5"
    )}>
      {children}
    </div>
  )
}

// =============================================================================
// Positioning Bullet - Uses shared HoverTooltip
// =============================================================================

// Icon mapping for each signal type
// Icons for signals and implications
const SIGNAL_ICONS: Record<string, LucideIcon> = {
  // Signal IDs
  employment_density: Building2,
  income_capture: Banknote,
  labour_capacity: Users,
  productivity_strength: Briefcase,
  growth_composition: TrendingUp,
  // Implication IDs - mapped to relevant icons
  employment_hub: Building2,
  daytime_footfall: Building2,
  dormitory_location: Home,
  commuter_uplift: Users,
  value_leakage: Banknote,
  hiring_constraints: Users,
  labour_availability: Users,
  productivity_led_growth: Briefcase,
  labour_led_growth: Briefcase,
  employment_growth_leading: TrendingUp,
  residential_pressure_building: Home,
  consumer_hub_opportunity: ShoppingBag,
  tight_market_constraints: Users,
  growth_opportunity: TrendingUp,
  regional_centre_profile: Building2,
  stable_residential_demand: TrendingUp,
  workforce_stability: Users,
  balanced_employment_base: Building2,
  aligned_income_output: Banknote,
}

function PositioningBulletItem({ 
  bullet, 
  index,
}: { 
  bullet: { text: string; signalId?: string }
  index: number
}) {
  // Get the appropriate icon for this signal
  const Icon = bullet.signalId ? SIGNAL_ICONS[bullet.signalId] : Target
  const FinalIcon = Icon || Target
  
  return (
    <div 
      className="group relative flex items-start gap-4 p-3 rounded-lg bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-background/80 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-3 cursor-default"
      style={{ animationDelay: `${200 + index * 120}ms`, animationFillMode: "backwards" }}
    >
      {/* Icon indicator based on signal type */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
        <FinalIcon className="h-3.5 w-3.5 text-primary" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">
          {bullet.text}
        </p>
      </div>
    </div>
  )
}

// =============================================================================
// Signal Chip - Colored version matching existing scheme
// =============================================================================

function SignalChipMini({ 
  label, 
  strength,
  detail,
}: { 
  label: string
  strength: 1 | 2 | 3 | 4
  detail?: string
}) {
  const [showDetail, setShowDetail] = useState(false)
  
  // Unified: strength determines both dots AND color
  const isExtreme = strength === 4  // Extreme → Purple
  const isGood = strength === 3     // High/Rising → Green
  const isCaution = strength === 2  // Neutral → Amber
  const isBad = strength === 1      // Low/Falling → Red
  
  // Dot color based on strength
  const dotColor = strength === 4
    ? "bg-violet-600 dark:bg-violet-400"
    : strength === 3 
      ? "bg-emerald-600 dark:bg-emerald-400"
      : strength === 2 
        ? "bg-amber-600 dark:bg-amber-400"
        : "bg-red-600 dark:bg-red-400"
  
  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
    >
      <button
        onClick={() => setShowDetail(!showDetail)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
          "border transition-all duration-200",
          "hover:scale-[1.02] active:scale-[0.98]",
          isExtreme && "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-200",
          isGood && "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200",
          isCaution && "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200",
          isBad && "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200"
        )}
      >
        <span>{label}</span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i <= (strength === 4 ? 3 : strength) ? dotColor : "bg-current opacity-20"
              )}
            />
          ))}
          {strength === 4 && (
            <div className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
          )}
        </div>
      </button>
      
      {/* Detail tooltip on hover/click - uses shared component */}
      {detail && (
        <HoverTooltip show={showDetail} position="below">
          {detail}
        </HoverTooltip>
      )}
    </div>
  )
}


// =============================================================================
// LAD Comparison Chart (Recharts) - Indexed with Forecast
// =============================================================================

interface LADComparisonChartProps {
  label: string
  mainRegion: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }
  peers: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }[]
  unit?: string
  forecastYear?: number
  mainColor?: string
  peerColors?: string[]
}

// House styling colors - main region violet, peers blue/coral
const MAIN_COLOR = "#7c3aed" // violet-600
const PEER_COLORS = [
  "#0ea5e9", // sky-500 (blue)
  "#f87171", // red-400 (coral/salmon)
]

function LADComparisonChart({ 
  label, 
  mainRegion, 
  peers, 
  unit = "",
  forecastYear = 2026,
  mainColor: mc,
  peerColors: pc,
}: LADComparisonChartProps) {
  const chartMainColor = mc ?? MAIN_COLOR
  const chartPeerColors = (pc && pc.length > 0) ? pc : PEER_COLORS
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  const textColor = isDarkMode ? "#9ca3af" : "#6b7280"
  
  // Find base year (last historical year) for indexing
  const baseYear = useMemo(() => {
    const historicalYears = mainRegion.data
      .filter(d => d.type === "historical" || (d.type == null && d.year < 2025))
      .map(d => d.year)
    return historicalYears.length > 0 ? Math.max(...historicalYears) : 2024
  }, [mainRegion.data])
  
  // Get base values for indexing (at base year)
  const baseValues = useMemo(() => {
    const bases: Record<string, number> = {}
    const mainBase = mainRegion.data.find(d => d.year === baseYear)
    if (mainBase) bases.main = mainBase.value
    peers.forEach((peer, i) => {
      const peerBase = peer.data.find(d => d.year === baseYear)
      if (peerBase) bases[`peer${i}`] = peerBase.value
    })
    return bases
  }, [mainRegion.data, peers, baseYear])
  
  // Determine forecast start year
  const forecastStartYear = useMemo(() => {
    const mainFcstYears = mainRegion.data.filter(d => d.type === "forecast").map(d => d.year)
    if (mainFcstYears.length > 0) return Math.min(...mainFcstYears)
    return 2025 // Default assumption
  }, [mainRegion.data])
  
  // Build indexed chart data with historical/forecast split
  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, any>>()
    
    // Add main region data with indexing
    mainRegion.data.forEach(pt => {
      if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
      const row = yearMap.get(pt.year)!
      const indexed = baseValues.main ? (pt.value / baseValues.main) * 100 : pt.value
      const isForecast = pt.type === "forecast" || pt.year >= forecastStartYear
      
      if (isForecast) {
        row.main_fcst = indexed
        // Bridge at forecast start
        if (pt.year === forecastStartYear) row.main_hist = indexed
      } else {
        row.main_hist = indexed
      }
    })
    
    // Add peer data with indexing
    peers.forEach((peer, i) => {
      peer.data.forEach(pt => {
        if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
        const row = yearMap.get(pt.year)!
        const base = baseValues[`peer${i}`]
        const indexed = base ? (pt.value / base) * 100 : pt.value
        const isForecast = pt.type === "forecast" || pt.year >= forecastStartYear
        
        if (isForecast) {
          row[`peer${i}_fcst`] = indexed
          if (pt.year === forecastStartYear) row[`peer${i}_hist`] = indexed
        } else {
          row[`peer${i}_hist`] = indexed
        }
      })
    })
    
    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [mainRegion, peers, baseValues, forecastStartYear])
  
  // Calculate Y-axis domain (truncated to show differential)
  const yDomain = useMemo(() => {
    const allValues: number[] = []
    chartData.forEach(row => {
      if (row.main_hist != null) allValues.push(row.main_hist)
      if (row.main_fcst != null) allValues.push(row.main_fcst)
      peers.forEach((_, i) => {
        if (row[`peer${i}_hist`] != null) allValues.push(row[`peer${i}_hist`])
        if (row[`peer${i}_fcst`] != null) allValues.push(row[`peer${i}_fcst`])
      })
    })
    if (allValues.length === 0) return [90, 110]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.2
    return [
      Math.floor((min - padding) / 5) * 5,
      Math.ceil((max + padding) / 5) * 5
    ]
  }, [chartData, peers])
  
  // Bar chart data for forecast year comparison
  const barData = useMemo(() => {
    const fcstRow = chartData.find(d => d.year === forecastYear)
    if (!fcstRow) return []
    
    const data: { name: string; value: number; color: string; isMain: boolean }[] = []
    const mainVal = fcstRow.main_fcst ?? fcstRow.main_hist
    if (mainVal != null) {
      data.push({ name: mainRegion.name, value: mainVal, color: chartMainColor, isMain: true })
    }
    peers.forEach((peer, i) => {
      const peerVal = fcstRow[`peer${i}_fcst`] ?? fcstRow[`peer${i}_hist`]
      if (peerVal != null) {
        data.push({ name: peer.name, value: peerVal, color: chartPeerColors[i % chartPeerColors.length], isMain: false })
      }
    })
    return data.sort((a, b) => b.value - a.value)
  }, [chartData, forecastYear, mainRegion.name, peers])
  
  // Format indexed value for tooltip
  const formatIndexValue = (value: number) => value.toFixed(1)
  
  // Custom tooltip for line chart
  const LineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const isForecast = label > forecastStartYear
    
    // Deduplicate by region name - at transition years, both hist and fcst may have values
    const uniqueEntries = new Map<string, { name: string; value: number; color: string }>()
    payload.forEach((entry: any) => {
      if (entry.value == null) return
      const name = entry.dataKey.includes('main') 
        ? mainRegion.name 
        : peers[parseInt(entry.dataKey.replace(/peer(\d+).*/, '$1'))]?.name || 'Peer'
      // Only keep the first entry per region (historical takes precedence over forecast)
      if (!uniqueEntries.has(name)) {
        uniqueEntries.set(name, { name, value: entry.value, color: entry.color })
      }
    })
    
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">
          {label} {isForecast && <span className="text-muted-foreground font-normal">(forecast)</span>}
        </p>
        {Array.from(uniqueEntries.values()).map((entry, i) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {formatIndexValue(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  
  // Custom tooltip for bar chart
  const BarTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const data = payload[0]?.payload
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{data?.name}</p>
        <p style={{ color: data?.color }}>{forecastYear} Index: {formatIndexValue(data?.value)}</p>
        <p className="text-muted-foreground mt-1">
          vs {baseYear}: {data?.value > 100 ? '+' : ''}{(data?.value - 100).toFixed(1)}%
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label} <span className="font-normal">(indexed to {baseYear} = 100)</span>
        </span>
      </div>
      
      {/* Line Chart - Indexed Trend */}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.4} />
            <XAxis 
              dataKey="year" 
              tick={{ fontSize: 10, fill: textColor }}
              axisLine={{ stroke: gridStroke }}
              tickLine={{ stroke: gridStroke }}
            />
            <YAxis 
              domain={yDomain}
              tick={{ fontSize: 10, fill: textColor }}
              axisLine={{ stroke: gridStroke }}
              tickLine={{ stroke: gridStroke }}
              width={35}
            />
            <RechartsTooltip content={<LineTooltip />} />
            <ReferenceLine y={100} stroke={gridStroke} strokeDasharray="2 2" />
            
            {/* Peer lines - historical (solid) */}
            {peers.map((peer, i) => (
              <Line
                key={`${peer.name}_hist`}
                type="monotone"
                dataKey={`peer${i}_hist`}
                name={peer.name}
                stroke={chartPeerColors[i % chartPeerColors.length]}
                strokeWidth={2}
                dot={false}
                strokeOpacity={0.8}
              />
            ))}
            
            {/* Peer lines - forecast (dashed) */}
            {peers.map((peer, i) => (
              <Line
                key={`${peer.name}_fcst`}
                type="monotone"
                dataKey={`peer${i}_fcst`}
                name={`${peer.name} (F)`}
                stroke={chartPeerColors[i % chartPeerColors.length]}
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 3"
                strokeOpacity={0.8}
              />
            ))}
            
            {/* Main region - historical (solid, prominent) */}
            <Line
              type="monotone"
              dataKey="main_hist"
              name={mainRegion.name}
              stroke={chartMainColor}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: chartMainColor }}
            />
            
            {/* Main region - forecast (dashed, prominent) */}
            <Line
              type="monotone"
              dataKey="main_fcst"
              name={`${mainRegion.name} (F)`}
              stroke={chartMainColor}
              strokeWidth={3}
              dot={false}
              strokeDasharray="6 3"
              activeDot={{ r: 4, strokeWidth: 2, fill: chartMainColor }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] px-1">
        <span className="flex items-center gap-2">
          <span className="w-4 h-1 rounded-full" style={{ backgroundColor: chartMainColor }} />
          <span className="text-foreground font-medium">{mainRegion.name}</span>
        </span>
        {peers.map((peer, i) => (
          <span key={peer.name} className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-full" style={{ backgroundColor: chartPeerColors[i % chartPeerColors.length] }} />
            <span className="text-muted-foreground">{peer.name}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto text-muted-foreground/70">
          <span className="w-4 h-[2.5px] rounded-full bg-muted-foreground/60" />
          <span>history (ONS)</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground/70">
          <span className="w-4 border-t-[2px] border-dashed border-muted-foreground/60" />
          <span>forecast</span>
        </span>
      </div>
      
      {/* Bar Chart - Forecast Year Comparison */}
      {barData.length > 0 && (
        <div className="pt-3 border-t border-border/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {forecastYear} Forecast Comparison
            </span>
          </div>
          <div className="h-[100px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[Math.min(yDomain[0], 95), Math.max(yDomain[1], 105)]}
                  tick={{ fontSize: 10, fill: textColor }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={{ stroke: gridStroke }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  tick={{ fontSize: 10, fill: textColor }}
                  axisLine={{ stroke: gridStroke }}
                  tickLine={false}
                  width={80}
                />
                <RechartsTooltip content={<BarTooltip />} cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                <ReferenceLine x={100} stroke={gridStroke} strokeDasharray="2 2" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      fillOpacity={entry.isMain ? 1 : 0.75}
                      stroke={entry.isMain ? entry.color : 'none'}
                      strokeWidth={entry.isMain ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Implication Icon Helper
// =============================================================================

function getImplicationIcon(id: string, text: string): typeof Sun {
  // Match by content keywords
  const lowerText = text.toLowerCase()
  if (lowerText.includes("daytime") || lowerText.includes("weekday") || lowerText.includes("footfall")) return Sun
  if (lowerText.includes("hiring") || lowerText.includes("workforce") || lowerText.includes("labour")) return Users
  if (lowerText.includes("residential") || lowerText.includes("housing")) return Home
  if (lowerText.includes("retail") || lowerText.includes("spending") || lowerText.includes("consumer")) return ShoppingBag
  if (lowerText.includes("office") || lowerText.includes("employment") || lowerText.includes("positioned")) return Building2
  if (lowerText.includes("expansion") || lowerText.includes("growth")) return TrendingUp
  
  return Activity // default
}

// =============================================================================
// Implication Card - Visually striking bullet with icon
// =============================================================================

// Explanation text for each implication - explains "why" on hover
// All 25 implication IDs with economically defensible explanations
// (17 original + 3 contextual combinations + 5 neutral-state)
const IMPLICATION_EXPLANATIONS: Record<string, string> = {
  // Employment Density implications
  "major_hub_worker_spend": "Extreme employment density (jobs far exceed local population) means the area functions as a regional employment centre. Daytime economic activity is dominated by workers commuting in, not local residents.",
  "weekday_demand_high": "High employment density indicates more jobs than working-age residents. During business hours, the effective population swells with commuters, supporting office-adjacent retail and F&B.",
  "weekday_demand_low": "Low employment density means most working-age residents commute elsewhere for work. Daytime economic activity is driven by residents rather than an influx of commuting workers.",
  "residential_catchment": "Low employment density indicates this is primarily a residential area with workers commuting out. Office demand is limited; convenience retail and residential uses align better with the population profile.",
  
  // Income Capture implications
  "affluent_commuter_base": "Resident incomes significantly exceed local economic output per head. This indicates high earners commuting to employment elsewhere, returning disposable income to the local area.",
  "local_spending_power": "Income capture is high: residents retain a significant share of economic value generated locally. This supports consumer-facing uses as household spending power aligns with local economic activity.",
  "output_centre_spend": "Very low income capture means economic output flows to non-resident stakeholders. Local residents have limited purchasing power; retail depends on worker spend during business hours.",
  "value_leakage": "Low income capture indicates a disconnect between local output and resident incomes. Economic value leaks to neighbouring areas through commuting patterns or corporate structures.",
  
  // Labour Capacity implications
  "hiring_constraints": "High labour market utilisation indicates limited spare workforce capacity. New occupiers face competition for workers, longer recruitment timelines, and potential wage pressure.",
  "labour_availability": "Lower employment rates indicate available workforce capacity. New occupiers can recruit locally without acute competition, supporting operational ramp-up.",
  
  // Productivity implications
  "productivity_led_growth": "High productivity indicates growth driven by output-per-worker gains rather than headcount expansion. Firms increase output before expanding space, so office absorption lags GVA growth.",
  "labour_led_growth": "Lower productivity indicates a volume-driven economy where growth requires proportional headcount expansion. Space demand tracks job creation closely.",
  
  // Growth Composition implications
  "employment_growth_leading": "Jobs are growing faster than population, indicating the area is attracting employment. This expands the daytime worker base, supporting office demand and worker-oriented retail.",
  "residential_pressure_building": "Population is growing faster than local job creation, indicating net in-migration of residents who work elsewhere. This creates demand for housing and local amenities.",
  
  // Combination implications
  "consumer_hub_opportunity": "Combination of low employment density and high income capture indicates an affluent residential catchment. Residents have strong purchasing power but commute elsewhere for work.",
  "tight_market_constraints": "High employment density combined with high labour utilisation creates acute hiring competition. New occupiers face structural recruitment constraints.",
  "growth_opportunity": "Low labour utilisation combined with employment-led growth indicates available workforce capacity in a growing employment market. Favourable conditions for occupier expansion.",
  
  // Contextual combination implications (neutral pairings)
  "regional_centre_profile": "Balanced employment density and productivity indicate an established regional centre. The economy is diversified across sectors rather than dominated by a single high-value or low-value cluster.",
  "stable_residential_demand": "Income capture and growth patterns are balanced, indicating predictable demand dynamics. Neither rapid residential pressure nor value leakage is distorting the local market.",
  "workforce_stability": "Labour market capacity matches economic growth rates. Workforce supply is sufficient for current expansion without creating acute hiring constraints.",
  
  // Neutral-state implications
  "balanced_employment_base": "Employment density near 1.0 means jobs roughly match working-age residents. The area functions as neither a pure employment hub nor a dormitory suburb, with mixed daytime and evening footfall patterns.",
  "aligned_income_output": "Resident incomes track local economic output, indicating neither significant value leakage to other areas nor an affluent commuter population. Local spending power aligns with local economic activity.",
  "standard_productivity": "GVA per job aligns with national averages, indicating a diversified economy without extreme sector concentration. Space demand follows typical employment-to-absorption ratios.",
  "balanced_growth_trajectory": "Population and employment are growing at similar rates, indicating stable demand dynamics without acute residential pressure or employment-led expansion.",
  "moderate_labour_market": "Employment rates are within normal ranges, indicating a functional labour market without acute constraints. New occupiers can recruit locally with typical competitive dynamics.",
}

// Get explanation for an implication based on ID
function getImplicationExplanation(id: string, _text: string): string {
  // Direct ID match (covers all 25 implication IDs)
  if (IMPLICATION_EXPLANATIONS[id]) return IMPLICATION_EXPLANATIONS[id]
  
  // Default for any edge cases
  return "This insight is derived from regional economic signals including employment density, income capture, and labour capacity indicators."
}

/**
 * Format verdict sentence with bold key terms for visual hierarchy
 * Key terms: economic archetypes, labour market states, temporal qualifiers
 */
function formatVerdictWithBold(sentence: string): React.ReactNode {
  // Key terms to bold (case-insensitive matching, preserve original case)
  const boldTerms = [
    "Residential catchment",
    "Employment destination", 
    "Major employment destination",
    "Major employment hub",
    "Tight labour market",
    "Labour market",
    "Affluent residential",
    "Major output centre",
    "through 2035",
    "hiring constraints persist",
    "residents commute",
  ]
  
  // Build regex pattern for all terms
  const pattern = new RegExp(`(${boldTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  
  // Split and map
  const parts = sentence.split(pattern)
  
  return parts.map((part, i) => {
    const isMatch = boldTerms.some(term => term.toLowerCase() === part.toLowerCase())
    if (isMatch) {
      return <strong key={i} className="font-semibold text-foreground">{part}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function ImplicationCard({ text, id, index }: { text: string; id: string; index: number }) {
  const [hovered, setHovered] = useState(false)
  const Icon = getImplicationIcon(id, text)
  const explanation = getImplicationExplanation(id, text)
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg",
            "bg-card/50 border border-border/30",
            "transition-all duration-200 cursor-pointer",
            hovered 
              ? "bg-card/80 border-border/50 scale-[1.01] shadow-sm" 
              : "bg-card/50 border-border/30",
            "animate-in fade-in-0 slide-in-from-left-2"
          )}
          style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors",
            hovered ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
          )}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-sm text-foreground/80 leading-relaxed pt-0.5">
            {text}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        align="end"
        className="max-w-sm bg-card/95 backdrop-blur-sm text-foreground border border-border/50 shadow-xl rounded-xl px-4 py-3"
        sideOffset={8}
      >
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Why</p>
          <p className="text-sm font-medium leading-relaxed text-foreground/90">{explanation}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}


// =============================================================================
// Logistics Positioning Block — used when lens === "industrial"
// Renders 1 lead + 3 supporting with hover "why" on each
// =============================================================================

const LOGISTICS_SIGNAL_ICONS: Record<string, LucideIcon> = {
  logistics_labour_available: Users,
  logistics_labour_constrained: Users,
  logistics_labour_balanced: Users,
  logistics_expansion_favourable: Users,
  logistics_expansion_contested: Users,
  logistics_slack_plus_employment_growth: Users,
  logistics_population_led_growth: TrendingUp,
  logistics_employment_led_growth: TrendingUp,
  logistics_growth_balanced: TrendingUp,
  logistics_labour_intensive_economy: Briefcase,
  logistics_knowledge_economy: Briefcase,
  logistics_standard_productivity: Briefcase,
  logistics_low_income_catchment: Banknote,
  logistics_affluent_catchment: Banknote,
}

function LogisticsPositioningBlock({
  lead,
  supporting,
  assetType,
  assetClass,
}: {
  lead: LogisticsImplication
  supporting: LogisticsImplication[]
  assetType?: string | null
  assetClass?: string | null
}) {
  const LeadIcon = LOGISTICS_SIGNAL_ICONS[lead.id] || Target

  return (
    <div className="relative overflow-visible rounded-xl border border-[#1d4ed8]/20 bg-gradient-to-br from-[#1d4ed8]/8 via-[#1d4ed8]/3 to-transparent">
      <div
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 animate-pulse"
        style={{ background: "radial-gradient(circle, rgba(29,78,216,0.4) 0%, transparent 70%)" }}
      />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#1d4ed8]/15 flex items-center justify-center animate-in zoom-in-95 duration-500">
            <Target className="h-5 w-5 text-[#1d4ed8]" />
          </div>
          <div className="animate-in fade-in-0 slide-in-from-left-3 duration-500">
            <p className="text-base font-semibold text-foreground">
              Key datapoints
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {/* Lead insight, highlighted */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative rounded-xl border border-[#1d4ed8]/30 bg-[#1d4ed8]/5 p-3.5 cursor-default animate-in fade-in-0 slide-in-from-bottom-3"
                style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-[#1d4ed8]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1d4ed8]">
                    Primary
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1d4ed8]/15">
                    <LeadIcon className="h-3.5 w-3.5 text-[#1d4ed8]" />
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {lead.text}
                  </p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="max-w-sm bg-card/95 backdrop-blur-sm text-foreground border border-border/50 shadow-xl rounded-xl px-4 py-3"
              sideOffset={8}
            >
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1d4ed8]">Why</p>
                <p className="text-sm font-medium leading-relaxed text-foreground/90">{lead.why}</p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Supporting insights */}
          {supporting.map((item, i) => {
            const ItemIcon = LOGISTICS_SIGNAL_ICONS[item.id] || Activity
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "group relative flex items-start gap-4 p-3 rounded-lg",
                      "bg-background/50 border border-border/30",
                      "hover:border-[#1d4ed8]/30 hover:bg-background/80",
                      "transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-3 cursor-default"
                    )}
                    style={{ animationDelay: `${250 + i * 120}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d4ed8]/10 flex items-center justify-center group-hover:bg-[#1d4ed8]/20 group-hover:scale-110 transition-all duration-300">
                      <ItemIcon className="h-3.5 w-3.5 text-[#1d4ed8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="end"
                  className="max-w-sm bg-card/95 backdrop-blur-sm text-foreground border border-border/50 shadow-xl rounded-xl px-4 py-3"
                  sideOffset={8}
                >
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#1d4ed8]">Why</p>
                    <p className="text-sm font-medium leading-relaxed text-foreground/90">{item.why}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Positioning Bullet Type & Asset-Aware Scoring
// =============================================================================

interface PositioningBullet {
  id: string
  text: string
  signalId: string
  score: number
}

// Implication priority weights by asset type - higher = more important for that asset
// Maps implication IDs to priority weights for each asset lens
const IMPLICATION_PRIORITY_BY_ASSET: Record<string, Record<string, number>> = {
  office: {
    // Productivity-related implications are most relevant for office
    productivity_led_growth: 100,
    labour_led_growth: 95,
    hiring_constraints: 85,
    labour_availability: 80,
    tight_market_constraints: 90,
    growth_opportunity: 85,
    employment_hub: 75,
    regional_centre_profile: 70,
  },
  retail: {
    // Footfall and spending power matter most for retail
    employment_hub: 100,
    daytime_footfall: 100,
    consumer_hub_opportunity: 95,
    commuter_uplift: 90,
    dormitory_location: 85,
    value_leakage: 80,
  },
  industrial: {
    // Labour availability is critical for industrial
    labour_availability: 100,
    hiring_constraints: 95,
    growth_opportunity: 90,
    tight_market_constraints: 85,
  },
  residential: {
    // Income and demographic factors matter for residential
    consumer_hub_opportunity: 100,
    stable_residential_demand: 95,
    residential_pressure_building: 90,
    dormitory_location: 85,
    value_leakage: 80,
  },
  leisure: {
    // Spending power and footfall for leisure
    consumer_hub_opportunity: 100,
    employment_hub: 95,
    daytime_footfall: 90,
    commuter_uplift: 85,
  },
}

// Default weights for implications not specifically mapped
const DEFAULT_IMPLICATION_PRIORITY = 50

/**
 * Resolves asset lens from metadata
 */
function resolveAssetLens(
  assetType: string | null | undefined,
  assetClass: string | null | undefined,
  tenantSector: string | null | undefined
): string {
  // Check ALL provided fields, not just the first truthy one.
  // Priority: assetClass > tenantSector > assetType (more specific wins).
  const candidates = [assetClass, tenantSector, assetType]
    .filter(Boolean)
    .map((s) => (s as string).toLowerCase())

  for (const token of candidates) {
    if (token.includes("office")) return "office"
    if (token.includes("retail") || token.includes("f&b") || token.includes("food") || token.includes("shop")) return "retail"
    if (token.includes("industrial") || token.includes("logistics") || token.includes("warehouse")) return "industrial"
    if (token.includes("resi") || token.includes("apartment") || token.includes("housing") || token.includes("btl")) return "residential"
    if (token.includes("leisure") || token.includes("hotel") || token.includes("gym") || token.includes("cinema")) return "leisure"
  }
  return "general"
}

// =============================================================================
// Main Component
// =============================================================================

// Peer comparison data interface
interface PeerComparisonData {
  metricId: string
  label: string
  mainRegion: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }
  peers: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }[]
}

export function AssetEconomicContext({
  regionCode,
  regionName,
  year,
  scenario,
  ladCode,
  assetType,
  assetClass,
  tenant,
  yieldInfo,
  hideCharts = false,
  hideSignalsSummary = false,
  tenantSector,
  mainColor: mainColorProp,
  peerColors: peerColorsProp,
}: AssetEconomicContextProps) {
  const activeMainColor = mainColorProp ?? MAIN_COLOR
  const activePeerColors = (peerColorsProp && peerColorsProp.length > 0) ? peerColorsProp : PEER_COLORS
  const [data, setData] = useState<PlaceInsightsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [peerComparisons, setPeerComparisons] = useState<PeerComparisonData[]>([])
  const [peersLoading, setPeersLoading] = useState(true)
  
  // Fetch insights
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
          throw new Error("Failed to fetch insights")
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error("Error fetching insights:", err)
        setError("Unable to load economic context")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchInsights()
  }, [regionCode, year, scenario])
  
  // Fetch peer comparison data for LAD chart
  useEffect(() => {
    async function fetchPeerData() {
      setPeersLoading(true)
      
      // Find peer regions: other LADs within the same ITL2 for LAD codes,
      // or sibling ITL3s within the same ITL2 for ITL3 codes
      let peerRegions: { code: string; name: string }[] = []
      const regionInfo = getRegionInfo(regionCode)
      
      // For LAD codes, get other LADs in the same ITL2 (with ITL1 fallback if needed)
      if (regionInfo?.level === "LAD") {
        const peerLADs = getPeerLADsWithFallback(regionCode, 2)
        if (peerLADs.length > 0) {
          peerRegions = peerLADs.slice(0, 2)
        }
      }
      
      // For ITL3 codes or if no LAD peers found
      if (peerRegions.length === 0) {
        let siblings = getSiblings(regionCode)
        
        // If no direct siblings (e.g., Cornwall is sole ITL3 in its ITL2),
        // go up to ITL2 and get sibling ITL2s within the same ITL1
        if (siblings.length === 0 && regionInfo?.level === "ITL3") {
          const itl2Code = regionCode.length === 5 ? regionCode.slice(0, 4) : regionCode
          const parentITL2 = getParent(itl2Code)
          if (parentITL2 && parentITL2.level === "ITL2") {
            siblings = getSiblings(parentITL2.code)
          }
        }
        
        if (siblings.length > 0) {
          peerRegions = siblings.slice(0, 2).map(s => ({ code: s.code, name: s.name }))
        }
      }
      
      // Fallback: if no peers found, use REGIONS config
      if (peerRegions.length === 0) {
        const regionConfig = REGIONS.find((r) => r.code === regionCode)
        if (regionConfig) {
          if (regionConfig.level === "ITL3") {
            const itl2Prefix = regionCode.slice(0, 4)
            const samePrefixRegions = REGIONS.filter(
              r => r.level === "ITL3" && 
                   r.code.startsWith(itl2Prefix) && 
                   r.code !== regionCode
            )
            if (samePrefixRegions.length > 0) {
              peerRegions = samePrefixRegions.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
            } else {
              // Sole ITL3 in ITL2 - compare to sibling ITL2s
              const itl1Prefix = regionCode.slice(0, 3)
              const siblingITL2s = REGIONS.filter(
                r => r.level === "ITL2" && 
                     r.code.startsWith(itl1Prefix) && 
                     r.code !== itl2Prefix
              )
              peerRegions = siblingITL2s.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
            }
          } else {
            const level = regionConfig.level || "ITL3"
            const sameLevel = REGIONS.filter(r => r.level === level && r.code !== regionCode)
            peerRegions = sameLevel.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
          }
        }
      }
      
      const metricsToCompare = [
        { id: "gdhi_per_head_gbp", label: "Income per Head" },
      ]
      
      const results: PeerComparisonData[] = []
      
      try {
        for (const metric of metricsToCompare) {
          try {
            // Fetch main region series
            const mainSeries = await fetchSeries({
              metricId: metric.id,
              region: regionCode,
              scenario,
            })
            
            // Extract data with year/value/type for indexing and forecast split
            const mainData = mainSeries
              .filter(d => d.year >= year - 10 && d.year <= year + 2) // Include forecast years
              .sort((a, b) => a.year - b.year)
              .map(d => ({ year: d.year, value: d.value, type: d.type }))
            
            // Fetch peer series (if we have peer regions)
            const peers: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }[] = []
            for (const peer of peerRegions) {
              try {
                const peerSeries = await fetchSeries({
                  metricId: metric.id,
                  region: peer.code,
                  scenario,
                })
                const peerData = peerSeries
                  .filter(d => d.year >= year - 10 && d.year <= year + 2)
                  .sort((a, b) => a.year - b.year)
                  .map(d => ({ year: d.year, value: d.value, type: d.type }))
                
                if (peerData.length > 0) {
                  peers.push({ name: peer.name, data: peerData })
                }
              } catch (err) {
                // Skip this peer if fetch fails
              }
            }
            
            // Show chart even without peers - main region data is valuable
            if (mainData.length > 0) {
              results.push({
                metricId: metric.id,
                label: metric.label,
                mainRegion: { name: regionName, data: mainData },
                peers,
              })
            }
          } catch (err) {
            console.error(`Failed to fetch peer data for ${metric.id}:`, err)
          }
        }
        
        setPeerComparisons(results)
      } catch (err) {
        console.error("Failed to fetch peer comparisons:", err)
      } finally {
        setPeersLoading(false)
      }
    }
    
    fetchPeerData()
  }, [regionCode, regionName, year, scenario])
  
  // Extract data safely for hooks (MUST be before any returns to satisfy Rules of Hooks)
  const ui = data?.ui
  const implications = data?.implications ?? []
  
  // Group signals by category (MUST be before any returns)
  const structureSignals = useMemo(() => 
    ui?.signals?.filter(s => STRUCTURE_SIGNALS.includes(s.id)) ?? []
  , [ui?.signals])
  
  const capacitySignals = useMemo(() => 
    ui?.signals?.filter(s => CAPACITY_SIGNALS.includes(s.id)) ?? []
  , [ui?.signals])
  
  // Generate asset-specific positioning bullets from implications (MUST be before any returns)
  // Score each implication based on asset type, pick the highest-scoring one
  const positioningBullets = useMemo(() => {
    if (!implications || implications.length === 0) return []
    
    // Resolve asset lens for scoring
    const lens = resolveAssetLens(assetType, assetClass, tenantSector)
    const assetPriorities = IMPLICATION_PRIORITY_BY_ASSET[lens] || {}
    
    // Score each implication based on asset-type relevance
    const scoredImplications = implications.map(impl => ({
      id: impl.id,
      text: impl.text,
      signalId: impl.id,
      // Use asset-specific priority if available, otherwise default
      score: assetPriorities[impl.id] ?? DEFAULT_IMPLICATION_PRIORITY,
    }))
    
    // Sort by score and pick the highest
    scoredImplications.sort((a, b) => b.score - a.score)
    
    return scoredImplications.length > 0 ? [scoredImplications[0]] : []
  }, [implications, assetType, assetClass, tenantSector])

  // Logistics-specific implications — replaces generic positioning + implication
  // cards when the asset lens resolves to "industrial"
  const isLogisticsLens = resolveAssetLens(assetType, assetClass, tenantSector) === "industrial"
  const logisticsInsights = useMemo(() => {
    if (!isLogisticsLens || !ui?.signals || ui.signals.length === 0) return null
    const signalInputs = ui.signals.map((s) => ({
      id: s.id,
      outcome: s.outcome,
      value: null,
    }))
    return deriveLogisticsImplications(signalInputs)
  }, [isLogisticsLens, ui?.signals])
  
  // Loading state - premium shimmer (AFTER all hooks)
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header shimmer */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 skeleton-shimmer rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-6 w-48 skeleton-shimmer rounded" />
            <div className="h-4 w-32 skeleton-shimmer rounded" />
          </div>
        </div>
        {/* Verdict shimmer */}
        <div className="p-4 rounded-xl border border-border/30 space-y-2">
          <div className="h-5 w-full skeleton-shimmer rounded" />
          <div className="h-5 w-4/5 skeleton-shimmer rounded" />
        </div>
        {/* Signals shimmer */}
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-28 skeleton-shimmer rounded-full" />
          <div className="h-8 w-32 skeleton-shimmer rounded-full" />
          <div className="h-8 w-36 skeleton-shimmer rounded-full" />
        </div>
      </div>
    )
  }
  
  // Error state (AFTER all hooks)
  if (error || !ui) {
    return (
      <div className="p-4 rounded-lg border border-border/30 bg-card/30">
        <p className="text-sm text-muted-foreground">
          {error || "Economic context unavailable"}
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-5">
      {!hideSignalsSummary ? (
        <>
          {/* Verdict sentence with visual glyph - no header, archetype now in asset header */}
          <div className="-mt-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-border/40 bg-muted/30">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center">
              {/* Verdict Visual Glyph */}
              {ui.verdictVisual?.type && (
                <div className="flex-shrink-0 animate-in fade-in-0 zoom-in-95 duration-500">
                  <VerdictVisual
                    type={ui.verdictVisual.type as "boundary" | "outputVsJobs" | "workforceSlack" | "weekdayPull"}
                    payload={ui.verdictVisual.payload}
                  />
                </div>
              )}
              {/* Verdict text with bold key terms */}
              <p className="text-base md:text-lg text-foreground/90 leading-relaxed flex-1">
                {formatVerdictWithBold(ui.verdictSentence)}
              </p>
            </div>
          </div>

          {/* Signal chips - grouped by category, with Demand Context card */}
          <div className="flex gap-4">
            {/* Signals - left side */}
            <div className="flex-1 space-y-4">
              {/* Economic structure */}
              {structureSignals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Economic structure
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {structureSignals.map((signal, i) => (
                      <div
                        key={signal.id}
                        className="animate-in fade-in-0 slide-in-from-bottom-2"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                      >
                        <SignalChipMini
                          label={SIGNAL_LABELS[signal.id] || signal.label}
                          strength={signal.strength}
                          detail={signal.detail}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Labour capacity */}
              {capacitySignals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Labour capacity
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {capacitySignals.map((signal, i) => (
                      <div
                        key={signal.id}
                        className="animate-in fade-in-0 slide-in-from-bottom-2"
                        style={{ animationDelay: `${(structureSignals.length + i) * 60}ms`, animationFillMode: "backwards" }}
                      >
                        <SignalChipMini
                          label={SIGNAL_LABELS[signal.id] || signal.label}
                          strength={signal.strength}
                          detail={signal.detail}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Demand Context card - right side (temporarily hidden, code preserved) */}
            {/* TODO: Re-enable when ready
            {ui.signals && ui.signals.length > 0 && (
              <DemandContextCard
                sector={(tenantSector as TenantSector) || inferTenantSector(tenant)}
                signals={ui.signals}
                regionName={regionName}
              />
            )}
            */}
          </div>
        </>
      ) : null}
      
      {/* Positioning Insights — logistics engine or generic */}
      {logisticsInsights ? (
        <LogisticsPositioningBlock
          lead={logisticsInsights.lead}
          supporting={logisticsInsights.supporting}
          assetType={assetType}
          assetClass={assetClass}
        />
      ) : (
        <>
          {/* Asset-Specific Positioning Insights - Enhanced with animations */}
          {positioningBullets.length > 0 && (
            <div className="relative overflow-visible rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent">
              {/* Animated gradient glow */}
              <div 
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 animate-pulse"
                style={{ background: "radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)" }}
              />
              
              <div className="relative p-5 space-y-4">
                {/* Header with icon */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center animate-in zoom-in-95 duration-500">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div className="animate-in fade-in-0 slide-in-from-left-3 duration-500">
                    <p className="text-sm font-semibold text-foreground">
                      Key datapoints for positioning
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {assetType || assetClass || "Economic Positioning"}
                    </p>
                  </div>
                </div>
                
                {/* Bullets with staggered animations */}
                <div className="space-y-3 pt-1">
                  {positioningBullets.map((bullet, i) => (
                    <PositioningBulletItem
                      key={bullet.id}
                      bullet={bullet}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Implications - card-style bullets with icons */}
          {implications.length > 0 && (
            <div className="space-y-2">
              {implications.slice(0, 3).map((impl, i) => (
                <ImplicationCard 
                  key={impl.id} 
                  id={impl.id}
                  text={impl.text}
                  index={i}
                />
              ))}
            </div>
          )}
        </>
      )}
      
      {/* LAD Comparison Chart - only show if not hidden */}
      {!hideCharts && !peersLoading && peerComparisons.length > 0 && (
        <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              LAD Comparison
            </p>
            <span className="text-[10px] text-muted-foreground">10 year trend</span>
          </div>
          <div className="space-y-4">
            {peerComparisons.map((comparison, i) => (
              <div 
                key={comparison.metricId}
                className="animate-in fade-in-0 slide-in-from-left-2"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
              >
                <LADComparisonChart
                  label={comparison.label}
                  mainRegion={comparison.mainRegion}
                  peers={comparison.peers}
                  mainColor={activeMainColor}
                  peerColors={activePeerColors}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* LAD Chart loading shimmer - only show if not hidden */}
      {!hideCharts && peersLoading && (
        <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="h-4 w-28 skeleton-shimmer rounded" />
          <div className="h-[180px] w-full skeleton-shimmer rounded" />
          <div className="flex gap-4">
            <div className="h-2 w-20 skeleton-shimmer rounded" />
            <div className="h-2 w-16 skeleton-shimmer rounded" />
            <div className="h-2 w-18 skeleton-shimmer rounded" />
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Standalone Chart Component (for rendering below indicators)
// =============================================================================

interface AssetComparisonChartsProps {
  regionCode: string
  regionName: string
  year: number
  scenario: "baseline" | "upside" | "downside"
}

export function AssetComparisonCharts({
  regionCode,
  regionName,
  year,
  scenario,
}: AssetComparisonChartsProps) {
  const [peerComparisons, setPeerComparisons] = useState<PeerComparisonData[]>([])
  const [peersLoading, setPeersLoading] = useState(true)
  
  // Fetch peer comparison data
  useEffect(() => {
    async function fetchPeerData() {
      setPeersLoading(true)
      
      // Find peer regions: other LADs within the same ITL2 for LAD codes,
      // or sibling ITL3s within the same ITL2 for ITL3 codes
      let peerRegions: { code: string; name: string }[] = []
      const regionInfo = getRegionInfo(regionCode)
      
      // For LAD codes, get other LADs in the same ITL2 (with ITL1 fallback if needed)
      if (regionInfo?.level === "LAD") {
        const peerLADs = getPeerLADsWithFallback(regionCode, 2)
        if (peerLADs.length > 0) {
          peerRegions = peerLADs.slice(0, 2)
        }
      }
      
      // For ITL3 codes or if no LAD peers found
      if (peerRegions.length === 0) {
        let siblings = getSiblings(regionCode)
        
        // If no direct siblings (e.g., Cornwall is sole ITL3 in its ITL2),
        // go up to ITL2 and get sibling ITL2s within the same ITL1
        if (siblings.length === 0 && regionInfo?.level === "ITL3") {
          const itl2Code = regionCode.length === 5 ? regionCode.slice(0, 4) : regionCode
          const parentITL2 = getParent(itl2Code)
          if (parentITL2 && parentITL2.level === "ITL2") {
            siblings = getSiblings(parentITL2.code)
          }
        }
        
        if (siblings.length > 0) {
          peerRegions = siblings.slice(0, 2).map(s => ({ code: s.code, name: s.name }))
        }
      }
      
      // Fallback: if no peers found, use REGIONS config
      if (peerRegions.length === 0) {
        const regionConfig = REGIONS.find((r) => r.code === regionCode)
        if (regionConfig) {
          if (regionConfig.level === "ITL3") {
            const itl2Prefix = regionCode.slice(0, 4)
            const samePrefixRegions = REGIONS.filter(
              r => r.level === "ITL3" && 
                   r.code.startsWith(itl2Prefix) && 
                   r.code !== regionCode
            )
            if (samePrefixRegions.length > 0) {
              peerRegions = samePrefixRegions.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
            } else {
              // Sole ITL3 in ITL2 - compare to sibling ITL2s
              const itl1Prefix = regionCode.slice(0, 3)
              const siblingITL2s = REGIONS.filter(
                r => r.level === "ITL2" && 
                     r.code.startsWith(itl1Prefix) && 
                     r.code !== itl2Prefix
              )
              peerRegions = siblingITL2s.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
            }
          } else {
            const level = regionConfig.level || "ITL3"
            const sameLevel = REGIONS.filter(r => r.level === level && r.code !== regionCode)
            peerRegions = sameLevel.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
          }
        }
      }
      
      const metricsToCompare = [
        { id: "gdhi_per_head_gbp", label: "Income per Head" },
      ]
      
      const results: PeerComparisonData[] = []
      
      try {
        for (const metric of metricsToCompare) {
          try {
            const mainSeries = await fetchSeries({
              metricId: metric.id,
              region: regionCode,
              scenario,
            })
            
            const mainData = mainSeries
              .filter(d => d.year >= year - 10 && d.year <= year + 2)
              .sort((a, b) => a.year - b.year)
              .map(d => ({ year: d.year, value: d.value, type: d.type }))
            
            const peers: { name: string; data: { year: number; value: number; type?: "historical" | "forecast" }[] }[] = []
            for (const peer of peerRegions) {
              try {
                const peerSeries = await fetchSeries({
                  metricId: metric.id,
                  region: peer.code,
                  scenario,
                })
                const peerData = peerSeries
                  .filter(d => d.year >= year - 10 && d.year <= year + 2)
                  .sort((a, b) => a.year - b.year)
                  .map(d => ({ year: d.year, value: d.value, type: d.type }))
                
                if (peerData.length > 0) {
                  peers.push({ name: peer.name, data: peerData })
                }
              } catch (err) {
                // Skip this peer
              }
            }
            
            if (mainData.length > 0) {
              results.push({
                metricId: metric.id,
                label: metric.label,
                mainRegion: { name: regionName, data: mainData },
                peers,
              })
            }
          } catch (err) {
            console.error(`Failed to fetch peer data for ${metric.id}:`, err)
          }
        }
        
        setPeerComparisons(results)
      } catch (err) {
        console.error("Failed to fetch peer comparisons:", err)
      } finally {
        setPeersLoading(false)
      }
    }
    
    fetchPeerData()
  }, [regionCode, regionName, year, scenario])
  
  if (peersLoading) {
    return (
      <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
        <div className="h-4 w-28 skeleton-shimmer rounded" />
        <div className="h-[200px] w-full skeleton-shimmer rounded" />
        <div className="flex gap-4">
          <div className="h-2 w-20 skeleton-shimmer rounded" />
          <div className="h-2 w-16 skeleton-shimmer rounded" />
          <div className="h-2 w-18 skeleton-shimmer rounded" />
        </div>
      </div>
    )
  }
  
  if (peerComparisons.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Regional Comparison
        </p>
        <span className="text-[10px] text-muted-foreground">10 year trend with forecast</span>
      </div>
      <div className="space-y-4">
        {peerComparisons.map((comparison, i) => (
          <div 
            key={comparison.metricId}
            className="animate-in fade-in-0 slide-in-from-left-2"
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
          >
            <LADComparisonChart
              label={comparison.label}
              mainRegion={comparison.mainRegion}
              peers={comparison.peers}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
