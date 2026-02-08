"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTheme } from "next-themes"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import { REGIONS } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { cn } from "@/lib/utils"
import { getSiblings, getRegionInfo, getParent, getPeerLADsWithFallback } from "@/lib/region-hierarchy"

// =============================================================================
// Types
// =============================================================================

interface GPComparisonSectionProps {
  regionCode: string
  regionName: string
  year: number
  scenario: "baseline" | "upside" | "downside"
  /** Lease expiry string from OM (e.g., "July 2029", "May 2045") */
  leaseExpiry?: string | null
  /** Asset class - used to show additional metrics for specific asset types */
  assetClass?: string | null
}

interface MetricConfig {
  id: string
  label: string
  unit: string
  /** If true, this metric is computed from other metrics */
  computed?: boolean
  /** Source metric IDs for computed metrics */
  sourceMetrics?: string[]
}

interface PeerData {
  name: string
  data: { year: number; value: number; type?: "historical" | "forecast" }[]
}

// =============================================================================
// Constants
// =============================================================================

const BASE_METRICS: MetricConfig[] = [
  { id: "gdhi_per_head_gbp", label: "Income per Head", unit: "£" },
  { id: "nominal_gva_mn_gbp", label: "GVA", unit: "£m" },
  { id: "emp_total_jobs", label: "Employment", unit: "jobs" },
  { id: "population_total", label: "Population", unit: "" },
]

// Additional metric for industrial assets
const GVA_PER_JOB_METRIC: MetricConfig = {
  id: "gva_per_job",
  label: "GVA per Job",
  unit: "£/job",
  computed: true,
  sourceMetrics: ["nominal_gva_mn_gbp", "emp_total_jobs"],
}

// Chart colors - matching regional comparison
const MAIN_COLOR = "#7c3aed" // violet-600 (purple - main region)
const PEER_COLORS = [
  "#0ea5e9", // sky-500 (blue)
  "#f87171", // red-400 (coral/salmon)
]

// =============================================================================
// Custom Y-axis tick for bar chart - defined outside component for stable reference
// =============================================================================

interface BarYAxisTickProps {
  x?: number
  y?: number
  payload?: { value: string }
  regionName: string
  isDarkMode: boolean
  textColor: string
}

function BarYAxisTick({ x, y, payload, regionName, isDarkMode, textColor }: BarYAxisTickProps) {
  if (!payload) return null
  const isMainRegion = payload.value === regionName
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill={isMainRegion ? (isDarkMode ? "#fff" : "#000") : textColor}
      fontSize={9}
      fontWeight={isMainRegion ? 600 : 400}
    >
      {payload.value}
    </text>
  )
}

// =============================================================================
// GP Comparison Section Component
// =============================================================================

export function GPComparisonSection({
  regionCode,
  regionName,
  year,
  scenario,
  leaseExpiry,
  assetClass,
}: GPComparisonSectionProps) {
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  const gridStroke = isDarkMode ? "#333333" : "#E5E7EB"
  const textColor = isDarkMode ? "#9ca3af" : "#6b7280"
  
  // Determine which metrics to show based on asset class
  const METRICS = useMemo(() => {
    const isIndustrial = assetClass?.toLowerCase() === "industrial"
    if (isIndustrial) {
      return [...BASE_METRICS, GVA_PER_JOB_METRIC]
    }
    return BASE_METRICS
  }, [assetClass])
  
  // Parse lease expiry year from string like "July 2029" or "May 2045"
  const leaseExpiryYear = useMemo(() => {
    if (!leaseExpiry) return null
    const match = leaseExpiry.match(/\b(20\d{2})\b/)
    return match ? parseInt(match[1], 10) : null
  }, [leaseExpiry])

  // State
  const [selectedMetric, setSelectedMetric] = useState<string>(BASE_METRICS[0].id)
  const [mainData, setMainData] = useState<{ year: number; value: number; type?: "historical" | "forecast" }[]>([])
  const [peersData, setPeersData] = useState<PeerData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Get peer regions: other LADs within the same ITL2 for LAD codes,
  // or sibling ITL3s within the same ITL2 for ITL3 codes
  const peerRegions = useMemo(() => {
    const regionInfo = getRegionInfo(regionCode)
    
    // For LAD codes, get other LADs in the same ITL2 (with ITL1 fallback if needed)
    if (regionInfo?.level === "LAD") {
      const peerLADs = getPeerLADsWithFallback(regionCode, 2)
      if (peerLADs.length > 0) {
        return peerLADs.slice(0, 2)
      }
    }
    
    // For ITL3 codes, get sibling ITL3s in the same ITL2
    let siblings = getSiblings(regionCode)
    
    // If no direct siblings (e.g., Cornwall is sole ITL3 in its ITL2),
    // go up to ITL2 and get sibling ITL2s within the same ITL1
    if (siblings.length === 0 && regionInfo?.level === "ITL3") {
      const parentITL2 = getParent(regionCode.length === 5 ? regionCode.slice(0, 4) : regionCode)
      if (parentITL2 && parentITL2.level === "ITL2") {
        // Get sibling ITL2s (same ITL1 parent)
        siblings = getSiblings(parentITL2.code)
      }
    }
    
    if (siblings.length > 0) {
      // Return up to 2 sibling regions
      return siblings.slice(0, 2).map(s => ({ code: s.code, name: s.name }))
    }
    
    // Fallback: if no siblings found in hierarchy, use REGIONS config
    const regionConfig = REGIONS.find((r) => r.code === regionCode)
    if (!regionConfig) return []
    
    // For ITL3, find other ITL3s with the same ITL2 prefix (first 4 chars)
    if (regionConfig.level === "ITL3") {
      const itl2Prefix = regionCode.slice(0, 4) // e.g., TLI3 from TLI33
      const samePrefixRegions = REGIONS.filter(
        r => r.level === "ITL3" && 
             r.code.startsWith(itl2Prefix) && 
             r.code !== regionCode
      )
      if (samePrefixRegions.length > 0) {
        return samePrefixRegions.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
      }
      // If sole ITL3 in ITL2, compare to other ITL2s in same ITL1
      const itl1Prefix = regionCode.slice(0, 3) // e.g., TLK from TLK30
      const siblingITL2s = REGIONS.filter(
        r => r.level === "ITL2" && 
             r.code.startsWith(itl1Prefix) && 
             r.code !== itl2Prefix
      )
      return siblingITL2s.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
    }
    
    // For other levels, fall back to same-level regions
    const level = regionConfig.level || "ITL3"
    const sameLevel = REGIONS.filter(r => r.level === level && r.code !== regionCode)
    return sameLevel.slice(0, 2).map(r => ({ code: r.code, name: r.name }))
  }, [regionCode])

  // Helper: Compute GVA per job from GVA and Employment data
  const computeGvaPerJob = (
    gvaData: { year: number; value: number; type?: "historical" | "forecast" }[],
    empData: { year: number; value: number; type?: "historical" | "forecast" }[]
  ) => {
    const empByYear = new Map(empData.map(d => [d.year, d]))
    return gvaData
      .filter(d => empByYear.has(d.year))
      .map(d => {
        const emp = empByYear.get(d.year)!
        // GVA is in £m, employment is jobs count
        // GVA per job = (GVA * 1,000,000) / jobs
        const gvaPerJob = emp.value > 0 ? (d.value * 1_000_000) / emp.value : 0
        return { year: d.year, value: gvaPerJob, type: d.type }
      })
  }

  // Fetch data when metric changes
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      
      const metricConfig = METRICS.find(m => m.id === selectedMetric)
      const isComputedMetric = metricConfig?.computed && selectedMetric === "gva_per_job"
      
      try {
        if (isComputedMetric) {
          // Fetch both GVA and Employment for computed metric
          const [gvaSeries, empSeries] = await Promise.all([
            fetchSeries({ metricId: "nominal_gva_mn_gbp", region: regionCode, scenario }),
            fetchSeries({ metricId: "emp_total_jobs", region: regionCode, scenario }),
          ])
          
          const processedGva = gvaSeries
            .filter(d => d.year >= year - 10 && d.year <= year + 10)
            .sort((a, b) => a.year - b.year)
            .map(d => ({ year: d.year, value: d.value, type: d.type }))
          
          const processedEmp = empSeries
            .filter(d => d.year >= year - 10 && d.year <= year + 10)
            .sort((a, b) => a.year - b.year)
            .map(d => ({ year: d.year, value: d.value, type: d.type }))
          
          const computedMain = computeGvaPerJob(processedGva, processedEmp)
          setMainData(computedMain)
          
          // Fetch peer series for computed metric
          const peers: PeerData[] = []
          for (const peer of peerRegions) {
            try {
              const [peerGva, peerEmp] = await Promise.all([
                fetchSeries({ metricId: "nominal_gva_mn_gbp", region: peer.code, scenario }),
                fetchSeries({ metricId: "emp_total_jobs", region: peer.code, scenario }),
              ])
              
              const peerGvaData = peerGva
                .filter(d => d.year >= year - 10 && d.year <= year + 10)
                .sort((a, b) => a.year - b.year)
                .map(d => ({ year: d.year, value: d.value, type: d.type }))
              
              const peerEmpData = peerEmp
                .filter(d => d.year >= year - 10 && d.year <= year + 10)
                .sort((a, b) => a.year - b.year)
                .map(d => ({ year: d.year, value: d.value, type: d.type }))
              
              const computedPeer = computeGvaPerJob(peerGvaData, peerEmpData)
              if (computedPeer.length > 0) {
                peers.push({ name: peer.name, data: computedPeer })
              }
            } catch (err) {
              // Skip this peer if fetch fails
            }
          }
          setPeersData(peers)
        } else {
          // Standard metric fetch
          const mainSeries = await fetchSeries({
            metricId: selectedMetric,
            region: regionCode,
            scenario,
          })
          
          const processedMainData = mainSeries
            .filter(d => d.year >= year - 10 && d.year <= year + 10)
            .sort((a, b) => a.year - b.year)
            .map(d => ({ year: d.year, value: d.value, type: d.type }))
          
          setMainData(processedMainData)
          
          // Fetch peer series
          const peers: PeerData[] = []
          for (const peer of peerRegions) {
            try {
              const peerSeries = await fetchSeries({
                metricId: selectedMetric,
                region: peer.code,
                scenario,
              })
              const peerData = peerSeries
                .filter(d => d.year >= year - 10 && d.year <= year + 10)
                .sort((a, b) => a.year - b.year)
                .map(d => ({ year: d.year, value: d.value, type: d.type }))
              
              if (peerData.length > 0) {
                peers.push({ name: peer.name, data: peerData })
              }
            } catch (err) {
              // Skip this peer if fetch fails
            }
          }
          
          setPeersData(peers)
        }
      } catch (err) {
        console.error(`Failed to fetch data for ${selectedMetric}:`, err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [selectedMetric, regionCode, scenario, year, peerRegions, METRICS])

  // Find base year (last historical year) for indexing
  const baseYear = useMemo(() => {
    const historicalYears = mainData
      .filter(d => d.type === "historical" || (d.type == null && d.year < 2025))
      .map(d => d.year)
    return historicalYears.length > 0 ? Math.max(...historicalYears) : 2024
  }, [mainData])

  // Get base values for indexing
  const baseValues = useMemo(() => {
    const bases: Record<string, number> = {}
    const mainBase = mainData.find(d => d.year === baseYear)
    if (mainBase) bases.main = mainBase.value
    peersData.forEach((peer, i) => {
      const peerBase = peer.data.find(d => d.year === baseYear)
      if (peerBase) bases[`peer${i}`] = peerBase.value
    })
    return bases
  }, [mainData, peersData, baseYear])

  // Forecast starts FROM the base year (index year) - the index point is the transition
  // This ensures dashed lines begin at the index year, not the year after
  const forecastStartYear = baseYear

  // Build indexed chart data with historical/forecast split
  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, any>>()
    
    // Add main region data with indexing
    mainData.forEach(pt => {
      if (!yearMap.has(pt.year)) yearMap.set(pt.year, { year: pt.year })
      const row = yearMap.get(pt.year)!
      const indexed = baseValues.main ? (pt.value / baseValues.main) * 100 : pt.value
      const isForecast = pt.type === "forecast" || pt.year >= forecastStartYear
      
      if (isForecast) {
        row.main_fcst = indexed
        if (pt.year === forecastStartYear) row.main_hist = indexed
      } else {
        row.main_hist = indexed
      }
    })
    
    // Add peer data with indexing
    peersData.forEach((peer, i) => {
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
  }, [mainData, peersData, baseValues, forecastStartYear])

  // Calculate Y-axis domain (tighter truncation to emphasize differences)
  const yDomain = useMemo(() => {
    const allValues: number[] = []
    chartData.forEach(row => {
      if (row.main_hist != null) allValues.push(row.main_hist)
      if (row.main_fcst != null) allValues.push(row.main_fcst)
      peersData.forEach((_, i) => {
        if (row[`peer${i}_hist`] != null) allValues.push(row[`peer${i}_hist`])
        if (row[`peer${i}_fcst`] != null) allValues.push(row[`peer${i}_fcst`])
      })
    })
    if (allValues.length === 0) return [95, 105]
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.08 // Tighter padding for more truncated view
    return [
      Math.floor((min - padding) / 2) * 2,
      Math.ceil((max + padding) / 2) * 2
    ]
  }, [chartData, peersData])

  // Bar chart data for absolute comparison at base year (last historical)
  const barData = useMemo(() => {
    const data: { name: string; value: number; color: string; isMain: boolean }[] = []
    
    // Get main region value at base year
    const mainPoint = mainData.find(d => d.year === baseYear)
    if (mainPoint) {
      data.push({ name: regionName, value: mainPoint.value, color: MAIN_COLOR, isMain: true })
    }
    
    // Get peer values at base year
    peersData.forEach((peer, i) => {
      const peerPoint = peer.data.find(d => d.year === baseYear)
      if (peerPoint) {
        data.push({ name: peer.name, value: peerPoint.value, color: PEER_COLORS[i % PEER_COLORS.length], isMain: false })
      }
    })
    
    return data.sort((a, b) => b.value - a.value)
  }, [mainData, peersData, baseYear, regionName])

  // Format indexed value for tooltip
  const formatIndexValue = (value: number) => value.toFixed(1)
  
  // Format absolute value based on metric
  const formatAbsoluteValue = (value: number) => {
    const metric = selectedMetricConfig
    if (!metric) return value.toLocaleString()
    
    if (metric.unit === '£') {
      // Income per head - format as currency
      return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    } else if (metric.unit === '£m') {
      // GVA - format as £Xm or £X.Xbn
      if (value >= 1000) {
        return `£${(value / 1000).toFixed(1)}bn`
      }
      return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}m`
    } else if (metric.unit === '£/job') {
      // GVA per job - format as currency
      if (value >= 1000) {
        return `£${(value / 1000).toFixed(1)}k`
      }
      return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    } else if (metric.unit === 'jobs') {
      // Employment - format with k/m suffix
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}m`
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}k`
      }
      return value.toLocaleString()
    } else {
      // Population or other - format with k/m suffix
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}m`
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}k`
      }
      return value.toLocaleString()
    }
  }

  // Compact axis tick formatter (avoids long labels like £38,000 on mobile)
  const formatAxisValue = (value: number) => {
    const metric = selectedMetricConfig
    if (!metric) return value.toLocaleString()

    if (metric.unit === '£' || metric.unit === '£/job') {
      if (value >= 1000) return `£${(value / 1000).toFixed(0)}K`
      return `£${value}`
    } else if (metric.unit === '£m') {
      if (value >= 1000) return `£${(value / 1000).toFixed(1)}bn`
      return `£${value}m`
    } else if (metric.unit === 'jobs') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
      if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
      return `${value}`
    } else {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
      if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
      return `${value}`
    }
  }

  // Custom tooltip for line chart
  const LineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const isForecast = label > forecastStartYear
    
    // Deduplicate by region name - at transition years, both hist and fcst may have values
    const uniqueEntries = new Map<string, { name: string; value: number; color: string }>()
    payload.forEach((entry: any) => {
      if (entry.value == null) return
      const name = entry.dataKey.includes('main') 
        ? regionName 
        : peersData[parseInt(entry.dataKey.replace(/peer(\d+).*/, '$1'))]?.name || 'Peer'
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
        <p style={{ color: data?.color }}>
          {selectedMetricConfig?.label}: {formatAbsoluteValue(data?.value)}
        </p>
        <p className="text-muted-foreground mt-1">
          As of {baseYear}
        </p>
      </div>
    )
  }

  const selectedMetricConfig = METRICS.find(m => m.id === selectedMetric)

  // Memoized tick renderer for stable reference - prevents Recharts re-render issues
  const renderBarYAxisTick = useCallback((props: any) => (
    <BarYAxisTick 
      {...props} 
      regionName={regionName}
      isDarkMode={isDarkMode}
      textColor={textColor}
    />
  ), [regionName, isDarkMode, textColor])

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Regional Comparison</h3>
          <p className="text-sm text-muted-foreground">
            {regionName} vs peer markets · Indexed from {baseYear}
          </p>
        </div>
      </div>

      {/* Metric Toggle Buttons */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              selectedMetric === metric.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="h-4 w-28 skeleton-shimmer rounded" />
          <div className="h-[240px] w-full skeleton-shimmer rounded" />
          <div className="flex gap-4">
            <div className="h-2 w-20 skeleton-shimmer rounded" />
            <div className="h-2 w-16 skeleton-shimmer rounded" />
          </div>
        </div>
      )}

      {/* Charts Container */}
      {!isLoading && chartData.length > 0 && (
        <div className="space-y-6 p-5 rounded-xl bg-card/50 border border-border/30">
          {/* Line Chart - Indexed Trend */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {selectedMetricConfig?.label} <span className="font-normal">(indexed to {baseYear} = 100)</span>
              </span>
            </div>
            <div className="h-[240px] w-full">
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
                  {/* Vertical forecast start line */}
                  <ReferenceLine 
                    x={forecastStartYear} 
                    stroke={textColor} 
                    strokeDasharray="4 4" 
                    strokeOpacity={0.6}
                    label={{ 
                      value: 'Forecast', 
                      position: 'insideTopLeft', 
                      fontSize: 9, 
                      fill: textColor,
                      opacity: 0.7,
                      dx: 4
                    }}
                  />
                  
                  {/* Lease expiry / WAULT marker */}
                  {leaseExpiryYear && leaseExpiryYear >= (year - 10) && leaseExpiryYear <= (year + 10) && (
                    <ReferenceLine 
                      x={leaseExpiryYear} 
                      stroke="#6b7280"
                      strokeWidth={2.5}
                      label={{ 
                        value: 'Lease Expiry', 
                        position: 'insideTopLeft', 
                        fontSize: 9, 
                        fill: '#6b7280',
                        fontWeight: 500,
                        dx: 4
                      }}
                    />
                  )}
                  
                  {/* Peer lines - historical (solid) */}
                  {peersData.map((peer, i) => (
                    <Line
                      key={`${peer.name}_hist`}
                      type="monotone"
                      dataKey={`peer${i}_hist`}
                      name={peer.name}
                      stroke={PEER_COLORS[i % PEER_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      strokeOpacity={0.8}
                    />
                  ))}
                  
                  {/* Peer lines - forecast (dashed) */}
                  {peersData.map((peer, i) => (
                    <Line
                      key={`${peer.name}_fcst`}
                      type="monotone"
                      dataKey={`peer${i}_fcst`}
                      name={`${peer.name} (F)`}
                      stroke={PEER_COLORS[i % PEER_COLORS.length]}
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
                    name={regionName}
                    stroke={MAIN_COLOR}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: MAIN_COLOR }}
                  />
                  
                  {/* Main region - forecast (dashed, prominent) */}
                  <Line
                    type="monotone"
                    dataKey="main_fcst"
                    name={`${regionName} (F)`}
                    stroke={MAIN_COLOR}
                    strokeWidth={3}
                    dot={false}
                    strokeDasharray="6 3"
                    activeDot={{ r: 4, strokeWidth: 2, fill: MAIN_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] px-1 mt-3">
              <span className="flex items-center gap-2">
                <span className="w-4 h-1 rounded-full" style={{ backgroundColor: MAIN_COLOR }} />
                <span className="text-foreground font-medium">{regionName}</span>
              </span>
              {peersData.map((peer, i) => (
                <span key={peer.name} className="flex items-center gap-2">
                  <span className="w-4 h-1 rounded-full" style={{ backgroundColor: PEER_COLORS[i % PEER_COLORS.length] }} />
                  <span className="text-muted-foreground">{peer.name}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5 ml-auto text-muted-foreground/70">
                <span className="w-3 border-t border-dashed border-muted-foreground" />
                <span>forecast</span>
              </span>
            </div>
          </div>

          {/* Bar Chart - Absolute Comparison at Base Year */}
          {barData.length > 0 && (
            <div className="pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {baseYear} {selectedMetricConfig?.label} Comparison
                </span>
              </div>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} horizontal={false} />
                    <XAxis 
                      type="number" 
                      tick={{ fontSize: 10, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                      tickFormatter={(value) => formatAxisValue(value)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name"
                      tick={{ fontSize: 10, fill: textColor }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={false}
                      width={100}
                    />
                    <RechartsTooltip content={<BarTooltip />} cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {barData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          opacity={entry.isMain ? 1 : 0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && chartData.length === 0 && (
        <div className="p-6 rounded-xl bg-muted/30 border border-border/30 text-center">
          <p className="text-sm text-muted-foreground">No comparison data available for this region.</p>
        </div>
      )}
    </div>
  )
}
