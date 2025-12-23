"use client"

import { useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Check } from "lucide-react"
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
  const isPresetYear = year === LAST_HISTORICAL || FORECAST_PRESETS.includes(year)
  
  // Generate all years for the dropdown
  const historicalYears = Array.from(
    { length: YEARS.forecastStart - YEARS.min },
    (_, i) => YEARS.forecastStart - 1 - i // Descending order: 2023, 2022, 2021...
  )
  const forecastYears = Array.from(
    { length: YEARS.max - YEARS.forecastStart + 1 },
    (_, i) => YEARS.forecastStart + i // Ascending order: 2024, 2025, 2026...
  )
  
  // Prepare grouped year lists:
  // - historicalYearsAsc: oldest -> newest actuals (so scrolling flows naturally)
  // - forecastYearsAsc: nearest forecast -> furthest
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

  return (
    <div id="tour-topbar" className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        
        {/* Left cluster: Logo + Region + Year (flows left-to-right in reading order) */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Logo */}
          <div className="relative h-16 w-16 flex-shrink-0">
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

          {/* Year Selector - flows naturally after region */}
            <div 
            ref={yearSelectorRef}
              id="tour-year-selector"
              className={cn(
              "flex items-center gap-1.5 transition-all duration-500 ease-in-out",
              hideYearSelector 
                ? "opacity-0 scale-95 max-w-0 overflow-hidden pointer-events-none" 
                : "opacity-100 scale-100"
            )}
          >
            {/* Historical: show the last actual data year prominently */}
            <Button
              variant={year === LAST_HISTORICAL ? "default" : "outline"}
              size="sm"
              onClick={() => onYearChange(LAST_HISTORICAL)}
              className="h-8 px-3 text-sm"
            >
              {LAST_HISTORICAL}
              <span className="ml-1.5 text-xs opacity-70">(Last actual year — all indicators)</span>
            </Button>
            
            {/* Visual separator between historical and forecast */}
            <div className="h-5 w-px bg-border mx-1" />
            
            {/* Forecast presets */}
            {FORECAST_PRESETS.map((presetYear) => (
              <Button
                key={presetYear}
                variant={year === presetYear ? "default" : "ghost"}
                size="sm"
                onClick={() => onYearChange(presetYear)}
                className={cn(
                  "h-8 px-3 text-sm",
                  year === presetYear 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                )}
              >
                {presetYear}
              </Button>
            ))}
            
            {/* Dropdown for all other years */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={isPresetYear ? "ghost" : "default"}
                  size="sm"
                  className={cn(
                    "h-8 px-2 text-sm",
                    !isPresetYear && (isHistoricalYear 
                      ? "" 
                      : "bg-blue-600 hover:bg-blue-700 text-white")
                  )}
                >
                  {isPresetYear ? "All" : year}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-40">
                {/* Continuous list: Historical (Actuals) first, then Forecasts */}
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                  Historical (Actuals)
                </DropdownMenuLabel>
                {combinedYears.map((y) => {
                  // Insert a lightweight inline label when forecasts start to guide the user,
                  // but keep it inside the same scrolling flow so it feels continuous.
                  if (y === YEARS.forecastStart) {
                    return (
                      <div key={y}>
                        <DropdownMenuLabel className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          Forecasts
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => onYearChange(y)}
                          className="cursor-pointer text-blue-600 dark:text-blue-400"
                        >
                          {year === y && <Check className="mr-2 h-3 w-3" />}
                          <span className={year === y ? "" : "ml-5"}>{y}</span>
                        </DropdownMenuItem>
                      </div>
                    )
                  }

                  // Regular year item (historical)
                  return (
                    <DropdownMenuItem
                      key={y}
                      onClick={() => onYearChange(y)}
                      className={cn(
                        "cursor-pointer",
                        y >= YEARS.forecastStart && "text-blue-600 dark:text-blue-400"
                      )}
                    >
                      {year === y && <Check className="mr-2 h-3 w-3" />}
                      <span className={year === y ? "" : "ml-5"}>{y}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right cluster: Scenario toggles - only on metric detail overview tab */}
        {showScenarioToggles && (
          <div className="flex rounded-lg border p-1 flex-shrink-0">
            {(["baseline", "upside", "downside"] as const).map((s) => (
              <Button
                key={s}
                variant={scenario === s ? "default" : "ghost"}
                size="sm"
                onClick={() => onScenarioChange?.(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
          )}
        
      </div>
    </div>
  )
}