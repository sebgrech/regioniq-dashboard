"use client"

import { useMemo } from "react"
import { Check, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FilterPill } from "./FilterPill"

interface YearPickerProps {
  selected: number[]
  onChange: (years: number[]) => void
  availableYears: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YearPicker({
  selected,
  onChange,
  availableYears,
  open,
  onOpenChange,
}: YearPickerProps) {
  const displayValue = useMemo(() => {
    if (selected.length === 0) return "Select years"
    const sorted = [...selected].sort((a, b) => a - b)
    if (sorted.length === 1) return String(sorted[0])
    if (sorted.length === 2) return `${sorted[0]}, ${sorted[1]}`
    // Check if contiguous range
    const isRange = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1)
    if (isRange) return `${sorted[0]}–${sorted[sorted.length - 1]}`
    return `${sorted.length} years`
  }, [selected])

  const toggle = (year: number) => {
    onChange(
      selected.includes(year)
        ? selected.filter((y) => y !== year)
        : [...selected, year]
    )
  }

  const selectRange = (from: number, to: number) => {
    const range = availableYears.filter((y) => y >= from && y <= to)
    onChange(range)
  }

  const currentYear = new Date().getFullYear()

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <FilterPill
            label="Years"
            value={displayValue}
            count={selected.length > 2 ? selected.length : undefined}
            isActive={open}
            onClick={() => onOpenChange(!open)}
            onClear={selected.length > 0 ? () => onChange([]) : undefined}
            showClear={selected.length > 0}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {/* Quick ranges */}
        <div className="p-2 border-b flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => selectRange(currentYear - 4, currentYear)}
          >
            Last 5 years
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => selectRange(currentYear - 9, currentYear)}
          >
            Last 10 years
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => selectRange(currentYear, currentYear + 10)}
          >
            Forecast
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange(availableYears)}
          >
            All years
          </Button>
        </div>

        <ScrollArea className="h-[240px]">
          <div className="p-2 grid grid-cols-4 gap-1">
            {availableYears.map((year) => {
              const isSelected = selected.includes(year)
              const isFuture = year > currentYear
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => toggle(year)}
                  className={cn(
                    "relative h-9 rounded-md text-sm font-mono transition-all",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !isSelected && isFuture && "text-muted-foreground"
                  )}
                >
                  {year}
                  {isSelected && (
                    <Check className="absolute top-1 right-1 h-3 w-3" />
                  )}
                </button>
              )
            })}
          </div>
        </ScrollArea>

        <div className="border-t p-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {selected.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange([])}
            disabled={!selected.length}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
