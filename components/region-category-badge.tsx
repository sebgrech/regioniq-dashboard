"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { RegionCategory } from "@/lib/region-category"

interface RegionCategoryBadgeProps {
  category: RegionCategory
  className?: string
}

export function RegionCategoryBadge({ category, className }: RegionCategoryBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium leading-none cursor-help",
              category.colorClass,
              className
            )}
          >
            <span className="text-base leading-none">{category.emoji}</span>
            <span>{category.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{category.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

