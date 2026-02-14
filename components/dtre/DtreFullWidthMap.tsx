"use client"

import { FullWidthMap } from "@/components/full-width-map"
import { DTRE_MAP_METRICS } from "@/components/dtre/dtre-map-config"
import type { ComponentProps } from "react"

type SharedFullWidthMapProps = ComponentProps<typeof FullWidthMap>

export function DtreFullWidthMap(props: Omit<SharedFullWidthMapProps, "metrics" | "mapControlsSide" | "fullscreenBrandMode" | "showViewDetailsCta" | "showCatchmentAction" | "showPersistentControls" | "showGranularityAtAllLevels" | "showUkGranularityOption" | "mode" | "defaultLevel" | "lockLevelToDefault">) {
  return (
    <FullWidthMap
      {...props}
      metrics={DTRE_MAP_METRICS}
      mapControlsSide="left"
      fullscreenBrandMode="dtre"
      mode="map-only"
      defaultLevel="LAD"
      lockLevelToDefault={false}
      showPersistentControls={true}
      showGranularityAtAllLevels={true}
      showUkGranularityOption={false}
      showViewDetailsCta={false}
      showCatchmentAction={false}
    />
  )
}
