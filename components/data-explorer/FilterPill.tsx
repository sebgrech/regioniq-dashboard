"use client"

import { X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterPillProps {
  label: string
  value: string
  count?: number
  onClear?: () => void
  onClick: () => void
  isActive?: boolean
  showClear?: boolean
}

export function FilterPill({
  label,
  value,
  count,
  onClear,
  onClick,
  isActive = false,
  showClear = true,
}: FilterPillProps) {
  return (
    <div
      className={cn(
        "group inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border transition-all duration-150",
        "bg-background hover:bg-muted/50 cursor-pointer select-none",
        isActive && "ring-2 ring-primary/20 border-primary/50 bg-primary/5"
      )}
      onClick={onClick}
    >
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <span className="text-sm font-medium truncate max-w-[180px]">{value}</span>
      {count !== undefined && count > 1 && (
        <span className="text-xs text-muted-foreground">+{count - 1}</span>
      )}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
          isActive && "rotate-180"
        )}
      />
      {showClear && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          className="ml-0.5 p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
