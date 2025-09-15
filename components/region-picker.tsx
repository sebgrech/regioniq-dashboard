"use client"

import { useState } from "react"
import { Check, Search, Map, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { REGIONS, type Region } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"

type RegionPickerProps =
  | {
      /** Single select */
      value: string
      onValueChange: (value: string) => void
      multiSelect?: false
      placeholder?: string
      className?: string
      exclude?: string[]
    }
  | {
      /** Multi select */
      value: string[]
      onValueChange: (value: string[]) => void
      multiSelect: true
      placeholder?: string
      className?: string
      exclude?: string[]
    }

export function RegionPicker({
  value,
  onValueChange,
  multiSelect = false,
  placeholder = "Select region...",
  className,
  exclude = [],
}: RegionPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // Recent selections (mock data - could be from localStorage later)
  const recentSelections = ["UKI", "UKC", "UKD"]

  // Filter regions based on search + exclude list
  const filteredRegions = REGIONS.filter((region) => {
    if (exclude.includes(region.code)) return false
    const searchLower = search.toLowerCase()
    return (
      region.name.toLowerCase().includes(searchLower) ||
      region.code.toLowerCase().includes(searchLower) ||
      region.country.toLowerCase().includes(searchLower)
    )
  })

  // Group regions by country
  const groupedRegions = filteredRegions.reduce(
    (acc, region) => {
      if (!acc[region.country]) {
        acc[region.country] = []
      }
      acc[region.country].push(region)
      return acc
    },
    {} as Record<string, Region[]>,
  )

  const selectedRegions = multiSelect
    ? value
    : value
    ? [value]
    : []

  const selectedRegionObjects = REGIONS.filter((r) =>
    selectedRegions.includes(r.code),
  )

  const handleSelect = (regionCode: string) => {
    if (multiSelect) {
      const currentValues = value as string[]
      const newValues = currentValues.includes(regionCode)
        ? currentValues.filter((v) => v !== regionCode)
        : [...currentValues, regionCode]
      onValueChange(newValues)
    } else {
      onValueChange(regionCode)
      setOpen(false)
    }
  }

  const displayText = () => {
    if (selectedRegionObjects.length === 0) return placeholder
    if (selectedRegionObjects.length === 1) {
      return selectedRegionObjects[0].name
    }
    return `${selectedRegionObjects.length} regions selected`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedRegionObjects.length > 0 && (
              <div className="flex gap-1">
                {selectedRegionObjects.slice(0, 2).map((region) => (
                  <Badge key={region.code} variant="secondary" className="text-xs">
                    {region.code}
                  </Badge>
                ))}
                {selectedRegionObjects.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedRegionObjects.length - 2}
                  </Badge>
                )}
              </div>
            )}
            <span className="truncate">{displayText()}</span>
          </div>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search regions..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No regions found.</CommandEmpty>

            {/* Recent selections */}
            {search === "" && recentSelections.length > 0 && (
              <CommandGroup heading="Recent">
                {recentSelections
                  .filter((code) => !exclude.includes(code))
                  .map((code) => {
                    const region = REGIONS.find((r) => r.code === code)
                    if (!region) return null

                    return (
                      <CommandItem
                        key={region.code}
                        value={region.code}
                        onSelect={() => handleSelect(region.code)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {region.code}
                          </Badge>
                          <span>{region.name}</span>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            selectedRegions.includes(region.code)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            )}

            {/* Grouped regions */}
            {Object.entries(groupedRegions).map(([country, regions]) => (
              <CommandGroup key={country} heading={country}>
                {regions.map((region) => (
                  <CommandItem
                    key={region.code}
                    value={region.code}
                    onSelect={() => handleSelect(region.code)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="outline" className="text-xs">
                        {region.code}
                      </Badge>
                      <span>{region.name}</span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {region.level}
                      </Badge>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        selectedRegions.includes(region.code)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>

        {/* Footer actions */}
        <div className="border-t p-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                // TODO: Open map modal
                console.log("Open map picker")
              }}
            >
              <Map className="h-3 w-3 mr-1" />
              Pick on Map
            </Button>

            {multiSelect && selectedRegions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => onValueChange([])}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
