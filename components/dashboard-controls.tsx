"use client"

import { useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Check, Calendar } from "lucide-react"
import { YEARS, type Scenario } from "@/lib/metrics.config"
import { RegionSearch, type RegionMetadata } from "@/components/region-search"
import { cn } from "@/lib/utils"

interface DashboardControlsProps {
  region: string
  year: number
  onRegionChange: (metadata: RegionMetadata) => void
  onYearChange: (year: number) => void
  activeTab?: string // Optional - only passed from metric detail page
  // Scenario props - only used on metric detail overview tab
  scenario?: Scenario
  onScenarioChange?: (scenario: Scenario) => void
}

export function DashboardControls({
  region,
  year,
  onRegionChange,
  onYearChange,
  activeTab,
  scenario,
  onScenarioChange,
}: DashboardControlsProps) {
  const yearSelectorRef = useRef<HTMLDivElement>(null)

  // Determine visibility based on active tab (metric detail page context)
  const isMetricDetailPage = activeTab !== undefined
  // Hide year selector on overview, scenarios, analysis, AND data tabs
  const hideYearSelector =
    isMetricDetailPage &&
    (activeTab === "overview" || activeTab === "scenarios" || activeTab === "analysis" || activeTab === "data")
  // Show scenario toggles only on metric detail overview tab
  const showScenarioToggles = isMetricDetailPage && activeTab === "overview" && onScenarioChange

  // Year selector configuration
  // Last historical year is the year before forecasts start (ONS actual data)
  const LAST_HISTORICAL = YEARS.forecastStart - 1 // 2023
  const FORECAST_PRESETS = [2026, 2030, 2035, 2040]
  
  // Check what type of year is selected
  const isHistoricalYear = year < YEARS.forecastStart
  const isForecastPreset = FORECAST_PRESETS.includes(year)
  const isActualSelected = year === LAST_HISTORICAL
  
  // Prepare grouped year lists for dropdown
  const historicalYearsAsc = Array.from(
    { length: YEARS.forecastStart - YEARS.min },
    (_, i) => YEARS.min + i
  )
  const forecastYearsAsc = Array.from(
    { length: YEARS.max - YEARS.forecastStart + 1 },
    (_, i) => YEARS.forecastStart + i
  )
  // Combined continuous list: historical (oldest→newest) then forecasts (nearest→furthest)
  const combinedYears = [...historicalYearsAsc, ...forecastYearsAsc]

  // For mobile dropdown label
  const getMobileYearLabel = () => {
    if (isActualSelected) return `${LAST_HISTORICAL} · Actual`
    if (isForecastPreset) return `${year} · Forecast`
    if (isHistoricalYear) return `${year} · Historical`
    return `${year} · Forecast`
  }

  return (
    <div id="tour-topbar" className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        
        {/* Left cluster: Logo + Region + Year (flows left-to-right) */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Logo */}
          <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
            {/* Light mode logo */}
            <Image
              src="/x.png"
              alt="RegionIQ"
              fill
              className="object-contain dark:hidden"
              priority
            />
            {/* Dark mode logo */}
            <Image
              src="/Frame 11.png"
              alt="RegionIQ"
              fill
              className="object-contain hidden dark:block"
              priority
            />
          </div>

          {/* Region Picker */}
          <div id="tour-indicator-search" className="min-w-0">
            <RegionSearch
              value={region}
              onValueChange={onRegionChange}
              placeholder="Select region..."
            />
          </div>

          {/* Year Selector - Premium segmented control (stays with region) */}
          <div 
            ref={yearSelectorRef}
            id="tour-year-selector"
            className={cn(
              "flex-shrink-0 transition-all duration-500 ease-in-out",
              hideYearSelector 
                ? "opacity-0 scale-95 max-w-0 overflow-hidden pointer-events-none" 
                : "opacity-100 scale-100"
            )}
          >
          {/* Mobile: Compact dropdown - matches search bar */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium",
                    "bg-transparent border border-input",
                    "hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  )}
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    isHistoricalYear ? "text-foreground" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {getMobileYearLabel()}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                {/* Quick picks section */}
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Quick Select
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onYearChange(LAST_HISTORICAL)}
                  className="cursor-pointer"
                >
                  {year === LAST_HISTORICAL && <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />}
                  <span className={year === LAST_HISTORICAL ? "" : "ml-5"}>
                    {LAST_HISTORICAL}
                  </span>
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    Actual
                  </span>
                </DropdownMenuItem>
                {FORECAST_PRESETS.map((presetYear) => (
                  <DropdownMenuItem
                    key={presetYear}
                    onClick={() => onYearChange(presetYear)}
                    className="cursor-pointer text-blue-600 dark:text-blue-400"
                  >
                    {year === presetYear && <Check className="mr-2 h-3.5 w-3.5" />}
                    <span className={year === presetYear ? "" : "ml-5"}>{presetYear}</span>
                  </DropdownMenuItem>
                ))}
                
                {/* Full list */}
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-2">
                  All Years
                </DropdownMenuLabel>
                {combinedYears.map((y) => {
                  const isForecast = y >= YEARS.forecastStart
                  const isSelected = year === y
                  return (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => onYearChange(y)}
                      className={cn(
                        "cursor-pointer",
                        isForecast && "text-blue-600 dark:text-blue-400"
                      )}
                    >
                      {isSelected && <Check className="mr-2 h-3.5 w-3.5" />}
                      <span className={isSelected ? "" : "ml-5"}>{y}</span>
                      {y === LAST_HISTORICAL && (
                        <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Latest
                        </span>
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Clean segmented control - matches search bar */}
          <div className="hidden lg:flex items-center h-9 border border-input rounded-md">
            {/* Historical: Actual data year with badge */}
            <button
              onClick={() => onYearChange(LAST_HISTORICAL)}
              className={cn(
                "flex items-center gap-2 h-[calc(100%-6px)] my-[3px] ml-[3px] px-3 text-sm font-medium transition-colors cursor-pointer rounded",
                isActualSelected
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <span className="tabular-nums">{LAST_HISTORICAL}</span>
              <span className={cn(
                "px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded transition-colors",
                isActualSelected
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted-foreground/10 text-muted-foreground"
              )}>
              Actual
              </span>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-border" />

            {/* Forecast presets */}
            {FORECAST_PRESETS.map((presetYear, idx) => (
              <button
                key={presetYear}
                onClick={() => onYearChange(presetYear)}
                className={cn(
                  "h-[calc(100%-6px)] my-[3px] px-3 text-sm font-medium tabular-nums transition-colors cursor-pointer rounded",
                  idx < FORECAST_PRESETS.length - 1 && "mr-px",
                  year === presetYear
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 dark:text-blue-400 hover:bg-accent/50"
                )}
              >
                {presetYear}
              </button>
            ))}
            
            {/* All years dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-1 h-[calc(100%-6px)] my-[3px] mr-[3px] px-2.5 text-sm font-medium transition-colors cursor-pointer rounded",
                    // If a non-preset year is selected, show it highlighted
                    !isActualSelected && !isForecastPreset
                      ? isHistoricalYear
                        ? "bg-accent text-accent-foreground"
                        : "bg-blue-600 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {(!isActualSelected && !isForecastPreset) ? (
                    <span className="tabular-nums">{year}</span>
                  ) : (
                    <span className="text-xs">More</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Historical
                </DropdownMenuLabel>
                {historicalYearsAsc.map((y) => {
                  const isSelected = year === y
                  return (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => onYearChange(y)}
                      className="cursor-pointer"
                    >
                      {isSelected && <Check className="mr-2 h-3.5 w-3.5" />}
                      <span className={cn("tabular-nums", isSelected ? "" : "ml-5")}>{y}</span>
                      {y === LAST_HISTORICAL && (
                        <span className="ml-auto text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                          Latest
                        </span>
                      )}
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuLabel className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider mt-1">
                  Forecasts
                </DropdownMenuLabel>
                {forecastYearsAsc.map((y) => {
                  const isSelected = year === y
                  return (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => onYearChange(y)}
                      className="cursor-pointer text-blue-600 dark:text-blue-400"
                    >
                      {isSelected && <Check className="mr-2 h-3.5 w-3.5" />}
                      <span className={cn("tabular-nums", isSelected ? "" : "ml-5")}>{y}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* End of left cluster */}
        </div>

        {/* Right cluster: Scenario toggles - only on metric detail overview tab */}
        {showScenarioToggles && (
          <div className="hidden sm:flex items-center h-9 border border-input rounded-md flex-shrink-0">
            {(["baseline", "upside", "downside"] as const).map((s, idx) => (
              <button
                key={s}
                onClick={() => onScenarioChange?.(s)}
                className={cn(
                  "h-full px-3 text-sm font-medium capitalize transition-colors cursor-pointer",
                  idx < 2 && "border-r border-input",
                  scenario === s
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        
      </div>
    </div>
  )
}
