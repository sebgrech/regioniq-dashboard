"use client"

import { useRef } from "react"
import Image from "next/image"
import { Download, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import { RegionSearch, type RegionMetadata } from "@/components/region-search"
import { cn } from "@/lib/utils"

interface DashboardControlsProps {
  region: string
  year: number
  scenario: Scenario
  onRegionChange: (metadata: RegionMetadata) => void
  onYearChange: (year: number) => void
  onScenarioChange: (scenario: Scenario) => void
  onExport?: () => void
  activeTab?: string // Optional - only passed from metric detail page
}

export function DashboardControls({
  region,
  year,
  scenario,
  onRegionChange,
  onYearChange,
  onScenarioChange,
  onExport,
  activeTab,
}: DashboardControlsProps) {
  const sliderRef = useRef<HTMLDivElement>(null)

  // Calculate the position of the year label
  const getYearLabelPosition = () => {
    const percentage = ((year - YEARS.min) / (YEARS.max - YEARS.min)) * 100
    return percentage
  }

  const selectedRegion = REGIONS.find((r) => r.code === region)

  // Determine visibility and positioning based on active tab
  const isMetricDetailPage = activeTab !== undefined
  // Hide year slider on overview, scenarios, analysis, AND data tabs
  const hideYearSlider =
    isMetricDetailPage &&
    (activeTab === "overview" || activeTab === "scenarios" || activeTab === "analysis" || activeTab === "data")
  // Hide scenario toggles on scenarios, analysis, AND data tabs
  const hideScenarioToggles = isMetricDetailPage && (activeTab === "scenarios" || activeTab === "analysis" || activeTab === "data")
  const moveScenarioTogglesLeft = isMetricDetailPage && activeTab === "overview"

  // Snapshot year quick picks (kept lightweight + deterministic)
  // "Latest" is interpreted as the default "now-ish" snapshot for this product: forecast start year.
  const snapshotPresets = [
    { label: "Latest", year: YEARS.forecastStart },
    { label: "2026", year: 2026 },
    { label: "2030", year: 2030 },
    { label: "2035", year: 2035 },
  ].filter((p, idx, arr) => arr.findIndex((x) => x.year === p.year) === idx)

  return (
    <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-6 py-4 flex items-center justify-between relative">
        {/* Left cluster: Logo + Region + Scenario Toggles (when on overview) */}
        <div className="flex items-center gap-6 min-w-0 flex-shrink-0">
          {/* Logo */}
          <div className="relative h-20 w-20 flex-shrink-0">
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
          <RegionSearch
            value={region}
            onValueChange={onRegionChange}
            placeholder="Select region..."
          />

          {/* Scenario Toggle - positioned next to search when on overview */}
          {moveScenarioTogglesLeft && (
            <div 
              className={cn(
                "flex rounded-lg border p-1 slide-in-from-right"
              )}
            >
              {(["baseline", "upside", "downside"] as const).map((s) => (
                <Button
                  key={s}
                  variant={scenario === s ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onScenarioChange(s)}
                  className="capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Middle cluster: Year slider with dynamic label - animated hide/show */}
        <div 
          ref={sliderRef}
          className={cn(
            // NOTE: When hiding the slider we must collapse height too (not just opacity/translate),
            // otherwise it still affects layout and makes the header feel taller on some tabs.
            "flex-1 px-12 overflow-hidden transition-all duration-700 ease-in-out",
            hideYearSlider 
              ? "opacity-0 translate-x-full px-0 max-h-0 pointer-events-none" 
              : "opacity-100 translate-x-0 max-h-[240px]"
          )}
        >
          <div className="space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Snapshot year</span>
              <div className="hidden lg:flex flex-wrap items-center justify-end gap-2">
                {snapshotPresets.map((p) => (
                  <Button
                    key={p.label}
                    variant={year === p.year ? "default" : "outline"}
                    size="sm"
                    onClick={() => onYearChange(p.year)}
                    className="h-7 px-2 text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            
            <Slider
              value={[year]}
              onValueChange={(value) => onYearChange(value[0])}
              min={YEARS.min}
              max={YEARS.max}
              step={1}
              className="w-full"
            />
            
            {/* Dynamic year text below slider */}
            <div className="relative h-4">
              <div 
                className="absolute transform -translate-x-1/2 text-sm font-medium pointer-events-none"
                style={{ 
                  left: `${getYearLabelPosition()}%`,
                  transition: 'none'
                }}
              >
                {year}
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{YEARS.min}</span>
              <span>{YEARS.max}</span>
            </div>
          </div>
        </div>

        {/* Right cluster: Scenario + Export */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Scenario Toggle - on right side when NOT on overview */}
          {!moveScenarioTogglesLeft && (
            <div 
              className={cn(
                // Collapse width/height when hidden so it doesn't reserve space.
                "flex rounded-lg border p-1 overflow-hidden transition-all duration-700 ease-in-out",
                hideScenarioToggles
                  ? "opacity-0 translate-x-full max-w-0 max-h-0 p-0 border-0 pointer-events-none"
                  : "opacity-100 translate-x-0 max-w-[360px] max-h-20"
              )}
            >
            {(["baseline", "upside", "downside"] as const).map((s) => (
              <Button
                key={s}
                variant={scenario === s ? "default" : "ghost"}
                size="sm"
                onClick={() => onScenarioChange(s)}
                className="capitalize"
              >
                  {activeTab === "scenarios" ? `${s} scenario` : s}
              </Button>
            ))}
          </div>
          )}

          {/* Updated + Export */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated 2 min ago</span>
            </div>
            <Button variant="outline" size="sm" onClick={onExport} className="bg-transparent">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}