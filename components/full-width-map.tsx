"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { REGIONS, METRICS, type Scenario } from "@/lib/metrics.config"
import { formatValue } from "@/lib/data-service"
import { MapScaffold } from "@/components/map-scaffold"

interface FullWidthMapProps {
  selectedRegion: string
  mapMetric: string
  year: number
  scenario: Scenario
  allMetricsData: {
    metricId: string
    value: number
  }[]
  onRegionSelect: (region: string) => void
  onMapMetricChange: (metric: string) => void
}

export function FullWidthMap({
  selectedRegion,
  mapMetric,
  year,
  scenario,
  allMetricsData,
  onRegionSelect,
  onMapMetricChange,
}: FullWidthMapProps) {
  const region = REGIONS.find((r) => r.code === selectedRegion)
  const selectedMetric = METRICS.find((m) => m.id === mapMetric)
  const mapMetricData = allMetricsData.find((d) => d.metricId === mapMetric)

  return (
    <Card className="w-full h-[400px] lg:h-[500px] border-border/50">
      <CardContent className="p-0 h-full">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Map section - full width on mobile, 65% on desktop */}
          <div className="flex-1 lg:flex-[0_0_65%] relative overflow-hidden min-h-[250px] lg:min-h-full">
            <MapScaffold
              selectedRegion={selectedRegion}
              metric={mapMetric}
              year={year}
              scenario={scenario}
              onRegionSelect={onRegionSelect}
              className="h-full"
            />

            {/* Overlay: Metric value + title (kept from original design) */}
            <div className="absolute top-4 left-4 bg-background/80 backdrop-blur rounded-md px-3 py-2 shadow-md">
              <h3 className="text-lg font-semibold">{region?.name}</h3>
              <div className="text-2xl font-bold text-primary">
                {formatValue(mapMetricData?.value || 0, selectedMetric?.unit || "")}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedMetric?.title} • {year} {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
              </p>
            </div>
          </div>

          {/* Controls section - full width on mobile, 35% on desktop */}
          <div className="lg:flex-[0_0_35%] bg-card border-t lg:border-t-0 lg:border-l border-border/50 p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* Map Display Header */}
            <div className="space-y-3 lg:space-y-4">
              <h4 className="text-base lg:text-lg font-semibold">Map Display</h4>

              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:space-y-0">
                {METRICS.map((metric) => {
                  const isSelected = metric.id === mapMetric
                  return (
                    <Button
                      key={metric.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => onMapMetricChange(metric.id)}
                      className={`w-full justify-start gap-2 h-8 text-xs lg:text-sm ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? "bg-primary" : "border border-current"
                        }`}
                      />
                      <span className="truncate">{metric.title}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Legend section */}
            <div className="space-y-2 lg:space-y-3 pt-2 border-t border-border/50">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {selectedMetric?.title} Scale
              </h5>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 lg:h-3 bg-gradient-to-r from-chart-4/30 via-primary/50 to-chart-1 rounded-full" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
              <p className="text-xs text-muted-foreground">Data points: 12 regions</p>
            </div>

            {/* Region Info */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate mr-2">{region?.name}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {selectedRegion}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                <span>{year}</span>
                <span>•</span>
                <span className="capitalize">{scenario}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
