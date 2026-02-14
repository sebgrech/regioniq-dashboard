"use client"

import { MapScaffold } from "@/components/map-scaffold"
import { DTRE_MAP_METRICS } from "@/components/dtre/dtre-map-config"
import type { ComponentProps } from "react"

type SharedMapScaffoldProps = ComponentProps<typeof MapScaffold>

export function DtreMapScaffold(props: Omit<SharedMapScaffoldProps, "metrics" | "mapControlsSide" | "fullscreenBrandMode" | "showViewDetailsCta" | "showCatchmentAction" | "showPersistentControls" | "showGranularityAtAllLevels">) {
  return (
    <MapScaffold
      {...props}
      metrics={DTRE_MAP_METRICS}
      mapControlsSide="left"
      fullscreenBrandMode="dtre"
      showPersistentControls={true}
      showGranularityAtAllLevels={true}
      showViewDetailsCta={false}
      showCatchmentAction={false}
    />
  )
}
