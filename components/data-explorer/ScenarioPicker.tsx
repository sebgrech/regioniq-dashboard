"use client"

import { TrendingUp, TrendingDown, Minus, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FilterPill } from "./FilterPill"
import type { Scenario } from "@/lib/metrics.config"

interface ScenarioPickerProps {
  selected: Scenario[]
  onChange: (scenarios: Scenario[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const scenarios: { value: Scenario; label: string; description: string; icon: typeof Minus }[] = [
  {
    value: "baseline",
    label: "Baseline",
    description: "Most likely economic trajectory",
    icon: Minus,
  },
  {
    value: "upside",
    label: "Upside",
    description: "Optimistic growth scenario",
    icon: TrendingUp,
  },
  {
    value: "downside",
    label: "Downside",
    description: "Conservative/pessimistic scenario",
    icon: TrendingDown,
  },
]

export function ScenarioPicker({
  selected,
  onChange,
  open,
  onOpenChange,
}: ScenarioPickerProps) {
  const displayValue = selected.length === 0
    ? "Select scenario"
    : selected.length === 1
    ? scenarios.find((s) => s.value === selected[0])?.label ?? selected[0]
    : `${selected.length} scenarios`

  const toggle = (value: Scenario) => {
    if (selected.includes(value)) {
      // Don't allow deselecting if it's the last one
      if (selected.length > 1) {
        onChange(selected.filter((s) => s !== value))
      }
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div>
          <FilterPill
            label="Scenario"
            value={displayValue}
            count={selected.length > 1 ? selected.length : undefined}
            isActive={open}
            onClick={() => onOpenChange(!open)}
            showClear={false}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-1.5" align="start">
        <div className="space-y-0.5">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon
            const isSelected = selected.includes(scenario.value)
            return (
              <button
                key={scenario.value}
                type="button"
                onClick={() => toggle(scenario.value)}
                className={cn(
                  "w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors",
                  "hover:bg-muted/50",
                  isSelected && "bg-muted"
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    "mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {/* Icon */}
                <div
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                    scenario.value === "baseline" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    scenario.value === "upside" && "bg-green-500/10 text-green-600 dark:text-green-400",
                    scenario.value === "downside" && "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{scenario.label}</div>
                  <div className="text-xs text-muted-foreground">{scenario.description}</div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-2 px-2 text-[11px] text-muted-foreground">
          Select multiple scenarios to compare
        </div>
      </PopoverContent>
    </Popover>
  )
}
