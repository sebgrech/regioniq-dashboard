"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Check, Settings2, FileText } from "lucide-react"
import { YEARS, type Scenario } from "@/lib/metrics.config"
import { RegionSearch, type RegionMetadata } from "@/components/region-search"
import { cn } from "@/lib/utils"
import { isAdminEmail } from "@/lib/admin"
import { UserMenu } from "@/components/user-menu"

interface DashboardControlsProps {
  region: string
  year: number
  onRegionChange: (metadata: RegionMetadata) => void
  onYearChange: (year: number) => void
  activeTab?: string // Optional - only passed from metric detail page
  // Scenario props - only used on metric detail overview tab
  scenario?: Scenario
  onScenarioChange?: (scenario: Scenario) => void
  // User email - for showing admin controls
  userEmail?: string | null
  // API access flag from user_metadata
  apiAccess?: boolean
}

export function DashboardControls({
  region,
  year,
  onRegionChange,
  onYearChange,
  activeTab,
  scenario,
  onScenarioChange,
  userEmail,
  apiAccess,
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
  const yearTag = isHistoricalYear ? "Actuals" : "Forecast"

  const actualYearsAsc = Array.from(
    { length: YEARS.forecastStart - YEARS.min },
    (_, i) => YEARS.min + i
  )
  const forecastYearsAsc = Array.from(
    { length: YEARS.max - YEARS.forecastStart + 1 },
    (_, i) => YEARS.forecastStart + i
  )

  return (
    <div id="tour-topbar" className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        
        {/* Left cluster: Logo + Region + Year (flows left-to-right in reading order) */}
        <div className="flex flex-wrap items-center gap-4 min-w-0">
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
          <div id="tour-indicator-search" className="min-w-0 flex-1 basis-[240px]">
          <RegionSearch
            value={region}
            onValueChange={onRegionChange}
            placeholder="Select region..."
          />
          </div>

          {/* Year Selector (Stripe/Linear): one primary control + optional wide-screen presets */}
          <div
            ref={yearSelectorRef}
            id="tour-year-selector"
            className={cn(
              "flex items-center gap-2 transition-all duration-500 ease-in-out",
              "w-full sm:w-auto sm:flex-none",
              hideYearSelector
                ? "opacity-0 scale-95 max-w-0 overflow-hidden pointer-events-none"
                : "opacity-100 scale-100"
            )}
          >
            {/* Optional presets (desktop only) - outline style for clarity */}
            <div className="hidden lg:flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onYearChange(LAST_HISTORICAL)}
                className={cn(
                  "h-8 px-3 text-sm",
                  year === LAST_HISTORICAL 
                    ? "border-2 border-primary text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LAST_HISTORICAL}
                <span className="ml-1.5 text-xs opacity-70">(Actuals)</span>
              </Button>
              {FORECAST_PRESETS.map((presetYear) => (
                <Button
                  key={presetYear}
                  variant="ghost"
                  size="sm"
                  onClick={() => onYearChange(presetYear)}
                  className={cn(
                    "h-8 px-3 text-sm",
                    year === presetYear
                      ? "border-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  )}
                >
                  {presetYear}
                </Button>
              ))}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-sm">
                  Year: {year}
                  <span
                    className={cn(
                      "ml-2 text-xs font-medium",
                      isHistoricalYear ? "text-muted-foreground" : "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {yearTag}
                  </span>
                  <ChevronDown className="ml-2 h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-44">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                  Presets
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onYearChange(LAST_HISTORICAL)} className="cursor-pointer">
                  {year === LAST_HISTORICAL && <Check className="mr-2 h-3 w-3" />}
                  <span className={year === LAST_HISTORICAL ? "" : "ml-5"}>{LAST_HISTORICAL}</span>
                  <span className="ml-2 text-xs opacity-70">(Actuals)</span>
                </DropdownMenuItem>
                {FORECAST_PRESETS.map((y) => (
                  <DropdownMenuItem
                    key={y}
                    onClick={() => onYearChange(y)}
                    className="cursor-pointer text-blue-600 dark:text-blue-400"
                  >
                    {year === y && <Check className="mr-2 h-3 w-3" />}
                    <span className={year === y ? "" : "ml-5"}>{y}</span>
                    <span className="ml-2 text-xs opacity-70">(Forecast)</span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                  Actuals
                </DropdownMenuLabel>
                {actualYearsAsc.map((y) => (
                  <DropdownMenuItem key={y} onClick={() => onYearChange(y)} className="cursor-pointer">
                    {year === y && <Check className="mr-2 h-3 w-3" />}
                    <span className={year === y ? "" : "ml-5"}>{y}</span>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Forecast
                </DropdownMenuLabel>
                {forecastYearsAsc.map((y) => (
                  <DropdownMenuItem
                    key={y}
                    onClick={() => onYearChange(y)}
                    className="cursor-pointer text-blue-600 dark:text-blue-400"
                  >
                    {year === y && <Check className="mr-2 h-3 w-3" />}
                    <span className={year === y ? "" : "ml-5"}>{y}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right cluster: Scenario toggles + Admin button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Scenario toggles - only on metric detail overview tab */}
          {showScenarioToggles && (
            <div className="flex rounded-lg border p-1">
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

          {/* Admin buttons - only for admin users */}
          {isAdminEmail(userEmail) && (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Link href="/admin/assets">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Assets</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Link href="/admin/pipeline-runs">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Ops</span>
                </Link>
              </Button>
            </>
          )}

          {/* User menu - account dropdown */}
          <div id="tour-api-button">
            <UserMenu email={userEmail} apiAccess={apiAccess} />
          </div>
        </div>
        
      </div>
    </div>
  )
}