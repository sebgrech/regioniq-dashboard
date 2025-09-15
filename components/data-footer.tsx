"use client"

import { Clock, Database, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DataMetadata } from "@/lib/types"
import { formatRelativeTime } from "@/lib/data-service"

interface DataFooterProps {
  metadata: DataMetadata
  className?: string
}

export function DataFooter({ metadata, className }: DataFooterProps) {
  const qualityColor =
    metadata.dataQuality >= 90 ? "text-green-500" : metadata.dataQuality >= 70 ? "text-yellow-500" : "text-red-500"

  return (
    <footer className={`text-xs text-muted-foreground text-center py-4 border-t bg-muted/20 ${className || ""}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>
              Data: {metadata.version} from {metadata.source}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Updated {formatRelativeTime(metadata.lastUpdated)}</span>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle className={`h-3 w-3 ${qualityColor}`} />
            <span>Quality: {metadata.dataQuality}%</span>
          </div>

          <Badge variant="outline" className="text-xs">
            {metadata.modelRun}
          </Badge>
        </div>

        <div className="mt-2 text-xs opacity-75">
          Historical: {metadata.coverage.historical} • Forecast: {metadata.coverage.forecast}
        </div>
      </div>
    </footer>
  )
}
