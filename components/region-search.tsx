"use client"

import { useState, useMemo, useEffect } from "react"
import { Check, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { REGIONS } from "@/lib/metrics.config"
import { searchRegions, type GroupedResults, type ScoredRegion } from "@/lib/region-search"
import { cn } from "@/lib/utils"
import { CITY_REGIONS } from "@/lib/city-regions"

export type RegionLevel = "UK" | "ITL1" | "ITL2" | "ITL3" | "LAD"

export interface RegionMetadata {
  code: string
  name: string
  level: RegionLevel
  bbox: [number, number, number, number]
}

interface RegionSearchProps {
  value: string
  onValueChange: (metadata: RegionMetadata) => void
  placeholder?: string
  className?: string
}

const LEVEL_LABELS: Record<string, string> = {
  UK: "National",
  LAD: "LAD",
  CITY: "City",
  ITL3: "ITL3",
  ITL2: "ITL2",
  ITL1: "ITL1",
}

export function RegionSearch({
  value,
  onValueChange,
  placeholder = "Search regions...",
  className,
}: RegionSearchProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [regionIndex, setRegionIndex] = useState<Record<string, Omit<RegionMetadata, "code">> | null>(null)

  // Load region index on mount
  useEffect(() => {
    fetch('/processed/region-index.json')
      .then(res => res.json())
      .then(data => setRegionIndex(data))
      .catch(err => {
        console.error('Failed to load region index:', err)
      })
  }, [])

  const selectedRegion = REGIONS.find((r) => r.code === value)

  // Get recent searches from localStorage (optional)
  const recentSearches: string[] = []
  try {
    const stored = localStorage.getItem("region-search-recent")
    if (stored) {
      recentSearches.push(...JSON.parse(stored).slice(0, 5))
    }
  } catch {
    // Ignore localStorage errors
  }

  // Search and group results
  const groupedResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return null
    }
    return searchRegions(searchQuery, recentSearches)
  }, [searchQuery, recentSearches])

  const handleSelect = async (regionCode: string) => {
    // For city regions (CITY: prefix), use the first constituent LAD
    let actualCode = regionCode
    if (regionCode.startsWith("CITY:")) {
      const cityName = regionCode.replace("CITY:", "")
      const cityLads = CITY_REGIONS[cityName]
      if (cityLads && cityLads.length > 0) {
        actualCode = cityLads[0]
      }
    }

    // Load region metadata from index
    if (regionIndex && regionIndex[actualCode]) {
      const metadata = regionIndex[actualCode]
      const fullMetadata: RegionMetadata = {
        code: actualCode,
        name: metadata.name,
        level: metadata.level,
        bbox: metadata.bbox,
      }
      onValueChange(fullMetadata)
    } else {
      // Fallback: try to get from REGIONS config
      const region = REGIONS.find(r => r.code === actualCode)
      if (region) {
        // If no index available, create minimal metadata
        // This should only happen if region-index.json fails to load
        console.warn(`Region ${actualCode} not found in index, using fallback`)
        const fallbackMetadata: RegionMetadata = {
          code: actualCode,
          name: region.name,
          level: region.level,
          bbox: [-8, 49.5, 2, 61], // Default UK bounds
        }
        onValueChange(fallbackMetadata)
      } else {
        console.error(`Region ${actualCode} not found`)
      }
    }
    
    setOpen(false)
    setSearchQuery("")
    
    // Save to recent searches
    try {
      const recent = recentSearches.filter((c) => c !== regionCode)
      recent.unshift(regionCode)
      localStorage.setItem("region-search-recent", JSON.stringify(recent.slice(0, 5)))
    } catch {
      // Ignore localStorage errors
    }
  }

  const renderRegionItem = (region: ScoredRegion, showLevelBadge = true) => {
    // For city regions with CITY: prefix, check if any constituent LAD is selected
    const isCityRegion = region.code.startsWith("CITY:")
    const regionObj = REGIONS.find((r) => r.code === region.code)
    
    // Check if selected (either direct match or city region with selected LAD)
    const isSelected = value === region.code || 
      (isCityRegion && region.constituentLads?.includes(value))

    // For city regions, show constituent LADs count
    const cityInfo = region.constituentLads && region.constituentLads.length > 1
      ? ` (${region.constituentLads.length} ${region.constituentLads.length === 1 ? "borough" : "boroughs"})`
      : ""

    // Display code - for city regions, show first few LAD codes
    let displayCode = region.code
    if (isCityRegion && region.constituentLads && region.constituentLads.length > 0) {
      const codes = region.constituentLads.slice(0, 2).join(", ")
      displayCode = region.constituentLads.length > 2 
        ? `${codes}...` 
        : codes
    }

    return (
      <CommandItem
        key={region.code}
        value={`${region.code} ${region.name}`}
        onSelect={() => {
          // For city regions with CITY: prefix, select the first LAD as representative
          // For ITL regions (canonical city mappings), select the ITL code directly
          if (isCityRegion && region.code.startsWith("CITY:") && region.constituentLads && region.constituentLads.length > 0) {
            handleSelect(region.constituentLads[0])
          } else {
            // For ITL regions (like UKI for London, TLD3 for Manchester), select directly
            handleSelect(region.code)
          }
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showLevelBadge && (
            <Badge variant="outline" className="text-xs shrink-0">
              {LEVEL_LABELS[region.level] || region.level}
            </Badge>
          )}
          <span className="truncate">{region.name}{cityInfo}</span>
          {displayCode && displayCode.length < 30 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {displayCode}
            </span>
          )}
        </div>
        <Check
          className={cn(
            "ml-auto h-4 w-4 shrink-0",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </CommandItem>
    )
  }

  const renderGroupedResults = (results: GroupedResults) => {
    const hasResults =
      (results.topMatch && results.topMatch.length > 0) ||
      results.uk.length > 0 ||
      results.cities.length > 0 ||
      results.lads.length > 0 ||
      results.itl3.length > 0 ||
      results.itl2.length > 0 ||
      results.itl1.length > 0

    if (!hasResults) {
      return <CommandEmpty>No regions found.</CommandEmpty>
    }

    return (
      <>
        {results.topMatch && results.topMatch.length > 0 && (
          <CommandGroup heading="Top Match">
            {results.topMatch.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.uk.length > 0 && (
          <CommandGroup heading="National">
            {results.uk.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.cities.length > 0 && (
          <CommandGroup heading="Cities">
            {results.cities.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.lads.length > 0 && (
          <CommandGroup heading="Local Authorities">
            {results.lads.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.itl3.length > 0 && (
          <CommandGroup heading="ITL3 Regions">
            {results.itl3.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.itl2.length > 0 && (
          <CommandGroup heading="ITL2 Regions">
            {results.itl2.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}

        {results.itl1.length > 0 && (
          <CommandGroup heading="ITL1 Regions">
            {results.itl1.map((region) => renderRegionItem(region))}
          </CommandGroup>
        )}
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[240px] justify-between bg-transparent", className)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="text-xs shrink-0">
              {selectedRegion?.code}
            </Badge>
            <span className="truncate">{selectedRegion?.name || placeholder}</span>
          </div>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search regions..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {groupedResults ? (
              renderGroupedResults(groupedResults)
            ) : (
              <CommandEmpty>Start typing to search...</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

