"use client"

import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { METRICS } from "@/lib/metrics.config"
import { cn } from "@/lib/utils"
import { FilterPill } from "./FilterPill"

interface MetricPickerProps {
  selected: string[]
  onChange: (metrics: string[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MetricPicker({ selected, onChange, open, onOpenChange }: MetricPickerProps) {
  const metricLabel = (id: string) => METRICS.find((m) => m.id === id)?.title ?? id

  const displayValue = selected.length === 0
    ? "Select metrics"
    : selected.length === 1
      ? metricLabel(selected[0])
      : `${selected.length} metrics`

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <FilterPill
            label="Metric"
            value={displayValue}
            count={selected.length}
            isActive={open}
            onClick={() => onOpenChange(!open)}
            onClear={selected.length > 0 ? () => onChange([]) : undefined}
            showClear={selected.length > 0}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search metrics..." className="h-10" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No metrics found.</CommandEmpty>
            <CommandGroup>
              {METRICS.map((m) => {
                const isSelected = selected.includes(m.id)
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.id} ${m.title}`}
                    onSelect={() => toggle(m.id)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1 truncate">{m.title}</span>
                    <Badge variant="outline" className="text-[10px] font-mono ml-2">
                      {m.id.split("_").slice(0, 2).join("_")}
                    </Badge>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange(METRICS.map((m) => m.id))}
            >
              Select all
            </Button>
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
