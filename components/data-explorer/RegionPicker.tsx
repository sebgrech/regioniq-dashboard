"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Check, Search, X, Clock, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FilterPill } from "./FilterPill"
import type { RegionIndexEntry } from "./types"
import { LEVEL_LABEL } from "./types"

interface RegionPickerProps {
  selected: string[]
  onChange: (regions: string[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  regionIndex: Record<string, RegionIndexEntry> | null
}

const RECENT_STORAGE_KEY = "regioniq-recent-regions"
const MAX_RECENT = 8

function getRecentRegions(): string[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentRegion(code: string) {
  if (typeof window === "undefined") return
  try {
    const recent = getRecentRegions().filter((r) => r !== code)
    recent.unshift(code)
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // ignore
  }
}

export function RegionPicker({
  selected,
  onChange,
  open,
  onOpenChange,
  regionIndex,
}: RegionPickerProps) {
  const [search, setSearch] = useState("")
  const [recentRegions, setRecentRegions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setRecentRegions(getRecentRegions())
    }
  }, [open])

  const regionLabel = useCallback(
    (code: string) => regionIndex?.[code]?.name ?? code,
    [regionIndex]
  )

  const displayValue = useMemo(() => {
    if (selected.length === 0) return "Select regions"
    if (selected.length === 1) return regionLabel(selected[0])
    return `${selected.length} regions`
  }, [selected, regionLabel])

  const toggle = useCallback(
    (code: string) => {
      addRecentRegion(code)
      onChange(selected.includes(code) ? selected.filter((x) => x !== code) : [...selected, code])
    },
    [selected, onChange]
  )

  const filteredRegions = useMemo(() => {
    if (!regionIndex) return []
    const q = search.trim().toLowerCase()
    const entries = Object.entries(regionIndex)

    if (!q) {
      // Show ITL1 regions when no search
      return entries
        .filter(([, v]) => v.level === "ITL1")
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
    }

    return entries
      .filter(
        ([code, v]) =>
          code.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // Prioritize exact matches and starts-with
        const aName = a[1].name.toLowerCase()
        const bName = b[1].name.toLowerCase()
        const aCode = a[0].toLowerCase()
        const bCode = b[0].toLowerCase()

        const aExact = aName === q || aCode === q
        const bExact = bName === q || bCode === q
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        const aStarts = aName.startsWith(q) || aCode.startsWith(q)
        const bStarts = bName.startsWith(q) || bCode.startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        return aName.localeCompare(bName)
      })
      .slice(0, 50)
  }, [regionIndex, search])

  const groupedByLevel = useMemo(() => {
    const groups: Record<string, Array<[string, RegionIndexEntry]>> = {}
    for (const [code, entry] of filteredRegions) {
      const level = entry.level
      if (!groups[level]) groups[level] = []
      groups[level].push([code, entry])
    }
    return groups
  }, [filteredRegions])

  const levelOrder = ["ITL1", "ITL2", "ITL3", "LAD"]

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <FilterPill
            label="Region"
            value={displayValue}
            count={selected.length}
            isActive={open}
            onClick={() => onOpenChange(!open)}
            onClear={selected.length > 0 ? () => onChange([]) : undefined}
            showClear={selected.length > 0}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          <div className="p-2">
            {/* Selected regions */}
            {selected.length > 0 && !search && (
              <div className="mb-3">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Check className="h-3 w-3" />
                  Selected
                </div>
                <div className="space-y-0.5">
                  {selected.slice(0, 10).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggle(code)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors"
                    >
                      <div className="h-4 w-4 rounded border bg-primary border-primary flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground w-[72px] shrink-0">
                        {code}
                      </span>
                      <span className="text-sm truncate flex-1 min-w-0">{regionLabel(code)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {regionIndex?.[code]?.level ?? ""}
                      </Badge>
                    </button>
                  ))}
                  {selected.length > 10 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      +{selected.length - 10} more selected
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent regions */}
            {recentRegions.length > 0 && !search && selected.length === 0 && (
              <div className="mb-3">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recent
                </div>
                <div className="space-y-0.5">
                  {recentRegions
                    .filter((code) => regionIndex?.[code])
                    .slice(0, 5)
                    .map((code) => {
                      const isSelected = selected.includes(code)
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggle(code)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors"
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground w-[72px] shrink-0">
                            {code}
                          </span>
                          <span className="text-sm truncate flex-1 min-w-0">{regionLabel(code)}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {regionIndex?.[code]?.level ?? ""}
                          </Badge>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Region list by level */}
            {!regionIndex ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading regions...
              </div>
            ) : filteredRegions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No regions found
              </div>
            ) : (
              levelOrder
                .filter((level) => groupedByLevel[level]?.length)
                .map((level) => (
                  <div key={level} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {LEVEL_LABEL[level]}
                      <span className="text-muted-foreground/60">
                        ({groupedByLevel[level].length})
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {groupedByLevel[level].map(([code, entry]) => {
                        const isSelected = selected.includes(code)
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggle(code)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-left transition-colors"
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                isSelected
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground w-[72px] shrink-0">
                              {code}
                            </span>
                            <span className="text-sm truncate flex-1 min-w-0">{entry.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))
            )}

            {/* Hint */}
            {!search && filteredRegions.length > 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Type to search ITL2, ITL3, or LAD regions
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange([])}
            disabled={!selected.length}
          >
            Clear all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
