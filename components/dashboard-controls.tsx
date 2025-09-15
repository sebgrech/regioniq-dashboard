"use client"

import { useState } from "react"
import Image from "next/image"
import { Search, Download, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { REGIONS, YEARS, type Scenario } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"

interface DashboardControlsProps {
  region: string
  year: number
  scenario: Scenario
  onRegionChange: (region: string) => void
  onYearChange: (year: number) => void
  onScenarioChange: (scenario: Scenario) => void
  onExport?: () => void
}

export function DashboardControls({
  region,
  year,
  scenario,
  onRegionChange,
  onYearChange,
  onScenarioChange,
  onExport,
}: DashboardControlsProps) {
  const [regionSearch, setRegionSearch] = useState("")
  const [isRegionOpen, setIsRegionOpen] = useState(false)
  const [itlLevel, setItlLevel] = useState("ITL1")

  // Filter regions based on search
  const filteredRegions = REGIONS.filter(
    (r) =>
      r.name.toLowerCase().includes(regionSearch.toLowerCase()) ||
      r.code.toLowerCase().includes(regionSearch.toLowerCase()),
  )

  // Group regions by country
  const groupedRegions = filteredRegions.reduce(
    (acc, region) => {
      if (!acc[region.country]) {
        acc[region.country] = []
      }
      acc[region.country].push(region)
      return acc
    },
    {} as Record<string, typeof REGIONS>,
  )

  const selectedRegion = REGIONS.find((r) => r.code === region)

  return (
    <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        {/* Left cluster: Logo + ITL + Region */}
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


          {/* ITL Level Toggle */}
          <div className="flex rounded-lg border p-1">
            {(["ITL1", "ITL2", "ITL3"] as const).map((level) => (
              <Button
                key={level}
                variant={itlLevel === level ? "default" : "ghost"}
                size="sm"
                onClick={() => setItlLevel(level)}
                className="text-xs"
              >
                {level}
              </Button>
            ))}
          </div>

          {/* Region Picker */}
          <Popover open={isRegionOpen} onOpenChange={setIsRegionOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={isRegionOpen}
                className="w-[240px] justify-between bg-transparent"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {selectedRegion?.code}
                  </Badge>
                  <span className="truncate">{selectedRegion?.name}</span>
                </div>
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <div className="p-3 border-b">
                <Input
                  placeholder="Search regions..."
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {Object.entries(groupedRegions).map(([country, regions]) => (
                  <div key={country}>
                    <div className="px-3 py-2 text-sm font-medium text-muted-foreground border-b">
                      {country}
                    </div>
                    {regions.map((r) => (
                      <button
                        key={r.code}
                        onClick={() => {
                          onRegionChange(r.code)
                          setIsRegionOpen(false)
                          setRegionSearch("")
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                          region === r.code && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Badge variant="outline" className="text-xs">
                          {r.code}
                        </Badge>
                        <span className="truncate">{r.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Middle cluster: Year slider fills remaining width */}
        <div className="flex-1 px-12">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Year</span>
              <span className="font-medium">{year}</span>
            </div>
            <Slider
              value={[year]}
              onValueChange={(value) => onYearChange(value[0])}
              min={YEARS.min}
              max={YEARS.max}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{YEARS.min}</span>
              <span className="text-primary">{YEARS.forecastStart}</span>
              <span>{YEARS.max}</span>
            </div>
          </div>
        </div>

        {/* Right cluster: Scenario + Export */}
        <div className="flex items-center gap-6 flex-shrink-0">
          {/* Scenario Toggle */}
          <div className="flex rounded-lg border p-1">
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
